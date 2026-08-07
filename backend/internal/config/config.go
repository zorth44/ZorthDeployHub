package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
)

type Config struct {
	ListenHost         string
	Port               int
	AuthSecret         string
	AuthUsername       string
	AuthPassword       string
	DatabasePath       string
	SSHPrivateKeyPath  string
	CookieSecure       bool
	CookieName         string
	SessionTTLHours    int
}

func Load() (Config, error) {
	cfg := Config{
		ListenHost:        envOr("LISTEN_HOST", "0.0.0.0"),
		Port:              envInt("PORT", 3000),
		AuthSecret:        os.Getenv("AUTH_SECRET"),
		AuthUsername:      envOr("AUTH_USERNAME", "admin"),
		AuthPassword:      envOr("AUTH_PASSWORD", "admin"),
		DatabasePath:      resolveDatabasePath(os.Getenv("DATABASE_URL")),
		SSHPrivateKeyPath: os.Getenv("SSH_PRIVATE_KEY_PATH"),
		CookieSecure:      envBool("COOKIE_SECURE", false),
		CookieName:        envOr("COOKIE_NAME", "zorth_session"),
		SessionTTLHours:   envInt("SESSION_TTL_HOURS", 168),
	}

	if strings.TrimSpace(cfg.AuthSecret) == "" {
		return Config{}, fmt.Errorf("AUTH_SECRET is required")
	}
	if strings.TrimSpace(cfg.SSHPrivateKeyPath) == "" {
		return Config{}, fmt.Errorf("SSH_PRIVATE_KEY_PATH is required")
	}
	return cfg, nil
}

func (c Config) Addr() string {
	return fmt.Sprintf("%s:%d", c.ListenHost, c.Port)
}

func resolveDatabasePath(databaseURL string) string {
	if databaseURL == "" {
		return "data/app.db"
	}
	const prefix = "file:"
	if strings.HasPrefix(databaseURL, prefix) {
		path := strings.TrimPrefix(databaseURL, prefix)
		path = strings.SplitN(path, "?", 2)[0]
		if strings.HasPrefix(path, "./") {
			return strings.TrimPrefix(path, "./")
		}
		return path
	}
	return databaseURL
}

func envOr(key, fallback string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return fallback
}

func envInt(key string, fallback int) int {
	v := strings.TrimSpace(os.Getenv(key))
	if v == "" {
		return fallback
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return fallback
	}
	return n
}

func envBool(key string, fallback bool) bool {
	v := strings.TrimSpace(os.Getenv(key))
	if v == "" {
		return fallback
	}
	switch strings.ToLower(v) {
	case "1", "true", "yes", "on":
		return true
	case "0", "false", "no", "off":
		return false
	default:
		return fallback
	}
}
