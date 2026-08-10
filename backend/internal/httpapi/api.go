package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"github.com/zorth44/zorth-deploy-hub/backend/internal/auth"
	"github.com/zorth44/zorth-deploy-hub/backend/internal/files"
	"github.com/zorth44/zorth-deploy-hub/backend/internal/groups"
	"github.com/zorth44/zorth-deploy-hub/backend/internal/servers"
	"github.com/zorth44/zorth-deploy-hub/backend/internal/static"
	"github.com/zorth44/zorth-deploy-hub/backend/internal/tags"
	"github.com/zorth44/zorth-deploy-hub/backend/internal/terminal"
)

type API struct {
	auth   *auth.Service
	store  *servers.Store
	groups *groups.Store
	tags   *tags.Store
	ws     *terminal.WSHandler
	files  *files.Handler
}

func New(
	authService *auth.Service,
	store *servers.Store,
	groupStore *groups.Store,
	tagStore *tags.Store,
	ws *terminal.WSHandler,
	filesHandler *files.Handler,
) *API {
	return &API{
		auth:   authService,
		store:  store,
		groups: groupStore,
		tags:   tagStore,
		ws:     ws,
		files:  filesHandler,
	}
}

func (a *API) Handler() http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Recoverer)

	r.Route("/api", func(api chi.Router) {
		api.With(middleware.Timeout(30*time.Second)).Post("/login", a.handleLogin)
		api.With(middleware.Timeout(30*time.Second)).Post("/logout", a.handleLogout)
		api.With(middleware.Timeout(30*time.Second)).Get("/me", a.handleMe)

		api.Group(func(pr chi.Router) {
			pr.Use(a.auth.Middleware)
			pr.Use(middleware.Timeout(60 * time.Second))
			pr.Get("/servers", a.handleListServers)
			pr.Post("/servers", a.handleCreateServer)
			pr.Put("/servers/{id}", a.handleUpdateServer)
			pr.Delete("/servers/{id}", a.handleDeleteServer)

			pr.Get("/groups", a.handleListGroups)
			pr.Post("/groups", a.handleCreateGroup)
			pr.Put("/groups/{id}", a.handleUpdateGroup)
			pr.Delete("/groups/{id}", a.handleDeleteGroup)

			pr.Get("/tags", a.handleListTags)
			pr.Post("/tags", a.handleCreateTag)
			pr.Put("/tags/{id}", a.handleUpdateTag)
			pr.Delete("/tags/{id}", a.handleDeleteTag)

			pr.Get("/sftp/list", a.files.List)
			pr.Get("/sftp/exists", a.files.Exists)
			pr.Post("/sftp/mkdir", a.files.Mkdir)
			pr.Delete("/sftp", a.files.Delete)
		})

		api.Group(func(pr chi.Router) {
			pr.Use(a.auth.Middleware)
			pr.Use(middleware.Timeout(30 * time.Minute))
			pr.Get("/sftp/download", a.files.Download)
			pr.Post("/sftp/upload", a.files.Upload)
		})

		api.Get("/terminal/ws", a.ws.ServeHTTP)
	})

	fileServer := static.Handler()
	r.Get("/*", func(w http.ResponseWriter, req *http.Request) {
		fileServer.ServeHTTP(w, req)
	})
	r.Head("/*", func(w http.ResponseWriter, req *http.Request) {
		fileServer.ServeHTTP(w, req)
	})

	return r
}

type loginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

func (a *API) handleLogin(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid request"})
		return
	}
	if !a.auth.Authenticate(strings.TrimSpace(req.Username), req.Password) {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "Invalid username or password"})
		return
	}
	if err := a.auth.SetSession(w, req.Username); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to create session"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "username": req.Username})
}

func (a *API) handleLogout(w http.ResponseWriter, r *http.Request) {
	a.auth.ClearSession(w)
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (a *API) handleMe(w http.ResponseWriter, r *http.Request) {
	session, err := a.auth.SessionFromRequest(r)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "Unauthorized"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"username": session.Username})
}

func (a *API) handleListServers(w http.ResponseWriter, r *http.Request) {
	list, err := a.store.List()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to list servers"})
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func (a *API) handleCreateServer(w http.ResponseWriter, r *http.Request) {
	var input servers.Input
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid request"})
		return
	}
	if input.Port == 0 {
		input.Port = 22
	}
	if input.TagIDs == nil {
		input.TagIDs = []string{}
	}
	server, err := a.store.Create(input)
	if err != nil {
		if errors.Is(err, servers.ErrValidation) {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": strings.TrimPrefix(err.Error(), "validation error: ")})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to create server"})
		return
	}
	writeJSON(w, http.StatusCreated, server)
}

func (a *API) handleUpdateServer(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var input servers.Input
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid request"})
		return
	}
	if input.Port == 0 {
		input.Port = 22
	}
	if input.TagIDs == nil {
		input.TagIDs = []string{}
	}
	server, err := a.store.Update(id, input)
	if err != nil {
		if errors.Is(err, servers.ErrNotFound) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "Not found"})
			return
		}
		if errors.Is(err, servers.ErrValidation) {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": strings.TrimPrefix(err.Error(), "validation error: ")})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to update server"})
		return
	}
	writeJSON(w, http.StatusOK, server)
}

func (a *API) handleDeleteServer(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := a.store.Delete(id); err != nil {
		if errors.Is(err, servers.ErrNotFound) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "Not found"})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to delete server"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (a *API) handleListGroups(w http.ResponseWriter, r *http.Request) {
	list, err := a.groups.List()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to list groups"})
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func (a *API) handleCreateGroup(w http.ResponseWriter, r *http.Request) {
	var input groups.Input
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid request"})
		return
	}
	group, err := a.groups.Create(input)
	if err != nil {
		writeCatalogError(w, err, "Failed to create group")
		return
	}
	writeJSON(w, http.StatusCreated, group)
}

func (a *API) handleUpdateGroup(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var input groups.Input
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid request"})
		return
	}
	group, err := a.groups.Update(id, input)
	if err != nil {
		if errors.Is(err, groups.ErrNotFound) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "Not found"})
			return
		}
		writeCatalogError(w, err, "Failed to update group")
		return
	}
	writeJSON(w, http.StatusOK, group)
}

func (a *API) handleDeleteGroup(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := a.groups.Delete(id); err != nil {
		if errors.Is(err, groups.ErrNotFound) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "Not found"})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to delete group"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (a *API) handleListTags(w http.ResponseWriter, r *http.Request) {
	list, err := a.tags.List()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to list tags"})
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func (a *API) handleCreateTag(w http.ResponseWriter, r *http.Request) {
	var input tags.Input
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid request"})
		return
	}
	tag, err := a.tags.Create(input)
	if err != nil {
		writeCatalogError(w, err, "Failed to create tag")
		return
	}
	writeJSON(w, http.StatusCreated, tag)
}

func (a *API) handleUpdateTag(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var input tags.Input
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid request"})
		return
	}
	tag, err := a.tags.Update(id, input)
	if err != nil {
		if errors.Is(err, tags.ErrNotFound) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "Not found"})
			return
		}
		writeCatalogError(w, err, "Failed to update tag")
		return
	}
	writeJSON(w, http.StatusOK, tag)
}

func (a *API) handleDeleteTag(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := a.tags.Delete(id); err != nil {
		if errors.Is(err, tags.ErrNotFound) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "Not found"})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to delete tag"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func writeCatalogError(w http.ResponseWriter, err error, fallback string) {
	switch {
	case errors.Is(err, groups.ErrValidation), errors.Is(err, tags.ErrValidation):
		msg := err.Error()
		msg = strings.TrimPrefix(msg, "validation error: ")
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": msg})
	case errors.Is(err, groups.ErrConflict), errors.Is(err, tags.ErrConflict):
		msg := err.Error()
		msg = strings.TrimPrefix(msg, "conflict: ")
		writeJSON(w, http.StatusConflict, map[string]string{"error": msg})
	default:
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": fallback})
	}
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
