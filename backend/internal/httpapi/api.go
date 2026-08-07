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
	"github.com/zorth44/zorth-deploy-hub/backend/internal/servers"
	"github.com/zorth44/zorth-deploy-hub/backend/internal/static"
	"github.com/zorth44/zorth-deploy-hub/backend/internal/terminal"
)

type API struct {
	auth  *auth.Service
	store *servers.Store
	ws    *terminal.WSHandler
}

func New(authService *auth.Service, store *servers.Store, ws *terminal.WSHandler) *API {
	return &API{auth: authService, store: store, ws: ws}
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
			pr.Get("/servers/status", a.handleStatus)
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

func (a *API) handleStatus(w http.ResponseWriter, r *http.Request) {
	list, err := a.store.List()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to list servers"})
		return
	}
	writeJSON(w, http.StatusOK, servers.ProbeAll(list))
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
