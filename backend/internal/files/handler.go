package files

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path"
	"strconv"
	"strings"

	"github.com/zorth44/zorth-deploy-hub/backend/internal/servers"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	serverID := strings.TrimSpace(r.URL.Query().Get("serverId"))
	if serverID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "serverId is required"})
		return
	}
	result, err := h.svc.List(serverID, r.URL.Query().Get("path"))
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (h *Handler) Mkdir(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ServerID string `json:"serverId"`
		Path     string `json:"path"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid request"})
		return
	}
	if strings.TrimSpace(req.ServerID) == "" || strings.TrimSpace(req.Path) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "serverId and path are required"})
		return
	}
	if err := h.svc.Mkdir(req.ServerID, req.Path); err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	serverID := strings.TrimSpace(r.URL.Query().Get("serverId"))
	rawPath := r.URL.Query().Get("path")
	if serverID == "" || strings.TrimSpace(rawPath) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "serverId and path are required"})
		return
	}
	recursive := r.URL.Query().Get("recursive") == "1" || strings.EqualFold(r.URL.Query().Get("recursive"), "true")
	if err := h.svc.Delete(serverID, rawPath, recursive); err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (h *Handler) Download(w http.ResponseWriter, r *http.Request) {
	serverID := strings.TrimSpace(r.URL.Query().Get("serverId"))
	rawPath := r.URL.Query().Get("path")
	if serverID == "" || strings.TrimSpace(rawPath) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "serverId and path are required"})
		return
	}

	name, size, reader, cleanup, err := h.svc.Download(serverID, rawPath)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	defer cleanup()

	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Disposition", contentDisposition(name))
	if size >= 0 {
		w.Header().Set("Content-Length", strconv.FormatInt(size, 10))
	}
	w.WriteHeader(http.StatusOK)
	_, _ = io.Copy(w, reader)
}

func (h *Handler) Upload(w http.ResponseWriter, r *http.Request) {
	maxMemory := int64(32 << 20)
	r.Body = http.MaxBytesReader(w, r.Body, h.svc.MaxUploadBytes()+maxMemory)
	if err := r.ParseMultipartForm(maxMemory); err != nil {
		var maxErr *http.MaxBytesError
		if errors.As(err, &maxErr) {
			writeJSON(w, http.StatusRequestEntityTooLarge, map[string]string{"error": "File too large"})
			return
		}
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid multipart form"})
		return
	}

	serverID := strings.TrimSpace(r.FormValue("serverId"))
	dirPath := r.FormValue("path")
	if serverID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "serverId is required"})
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "file is required"})
		return
	}
	defer file.Close()

	fileName := path.Base(header.Filename)
	if fileName == "." || fileName == "/" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid file name"})
		return
	}

	if err := h.svc.Upload(serverID, dirPath, fileName, file, header.Size); err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":   true,
		"path": path.Join(dirPath, fileName),
		"name": fileName,
	})
}

func (h *Handler) Exists(w http.ResponseWriter, r *http.Request) {
	serverID := strings.TrimSpace(r.URL.Query().Get("serverId"))
	dirPath := r.URL.Query().Get("path")
	name := strings.TrimSpace(r.URL.Query().Get("name"))
	if serverID == "" || name == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "serverId and name are required"})
		return
	}
	exists, err := h.svc.Exists(serverID, dirPath, name)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"exists": exists})
}

func writeServiceError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, servers.ErrNotFound):
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "Server not found"})
	case errors.Is(err, ErrNotFound):
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "Path not found"})
	case errors.Is(err, ErrBadPath):
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid path"})
	case errors.Is(err, ErrIsDir):
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Path is a directory"})
	case errors.Is(err, ErrNotDir):
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Path is not a directory"})
	case errors.Is(err, ErrNotEmpty):
		writeJSON(w, http.StatusConflict, map[string]string{"error": "Directory is not empty"})
	case errors.Is(err, ErrTooLarge):
		writeJSON(w, http.StatusRequestEntityTooLarge, map[string]string{"error": "File too large"})
	default:
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
	}
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func contentDisposition(name string) string {
	escaped := strings.ReplaceAll(name, `"`, `\"`)
	return fmt.Sprintf(`attachment; filename="%s"; filename*=UTF-8''%s`, escaped, url.PathEscape(name))
}
