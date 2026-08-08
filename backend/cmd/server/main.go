package main

import (
	"log"
	"net/http"
	"os"
	"time"

	"github.com/joho/godotenv"

	"github.com/zorth44/zorth-deploy-hub/backend/internal/auth"
	"github.com/zorth44/zorth-deploy-hub/backend/internal/config"
	"github.com/zorth44/zorth-deploy-hub/backend/internal/db"
	"github.com/zorth44/zorth-deploy-hub/backend/internal/files"
	"github.com/zorth44/zorth-deploy-hub/backend/internal/groups"
	"github.com/zorth44/zorth-deploy-hub/backend/internal/httpapi"
	"github.com/zorth44/zorth-deploy-hub/backend/internal/servers"
	"github.com/zorth44/zorth-deploy-hub/backend/internal/sshclient"
	"github.com/zorth44/zorth-deploy-hub/backend/internal/tags"
	"github.com/zorth44/zorth-deploy-hub/backend/internal/terminal"
)

func main() {
	_ = godotenv.Load()
	_ = godotenv.Load("../.env")

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	sqlDB, err := db.Open(cfg.DatabasePath)
	if err != nil {
		log.Fatalf("database: %v", err)
	}
	defer sqlDB.Close()

	authService := auth.New(auth.Config{
		Secret:       cfg.AuthSecret,
		Username:     cfg.AuthUsername,
		Password:     cfg.AuthPassword,
		CookieName:   cfg.CookieName,
		CookieSecure: cfg.CookieSecure,
		TTL:          time.Duration(cfg.SessionTTLHours) * time.Hour,
	})

	store := servers.NewStore(sqlDB)
	groupStore := groups.NewStore(sqlDB)
	tagStore := tags.NewStore(sqlDB)
	sshClient := sshclient.New(cfg.SSHPrivateKeyPath)
	termManager := terminal.NewManager(store, sshClient)
	wsHandler := terminal.NewWSHandler(authService, termManager)
	filesService := files.NewService(store, sshClient, cfg.SFTPMaxUploadBytes)
	filesHandler := files.NewHandler(filesService)
	api := httpapi.New(authService, store, groupStore, tagStore, wsHandler, filesHandler)

	server := &http.Server{
		Addr:              cfg.Addr(),
		Handler:           api.Handler(),
		ReadHeaderTimeout: 10 * time.Second,
	}

	log.Printf("ZorthDeployHub listening on http://%s", cfg.Addr())
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Printf("server stopped: %v", err)
		os.Exit(1)
	}
}
