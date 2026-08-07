package servers

import (
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/oklog/ulid/v2"
)

var ErrNotFound = errors.New("server not found")
var ErrValidation = errors.New("validation error")

type Server struct {
	ID        string  `json:"id"`
	Name      string  `json:"name"`
	Host      string  `json:"host"`
	Port      int     `json:"port"`
	Username  string  `json:"username"`
	Remark    *string `json:"remark"`
	CreatedAt string  `json:"createdAt"`
	UpdatedAt string  `json:"updatedAt"`
}

type Input struct {
	Name     string  `json:"name"`
	Host     string  `json:"host"`
	Port     int     `json:"port"`
	Username string  `json:"username"`
	Remark   *string `json:"remark"`
}

type Store struct {
	db *sql.DB
}

func NewStore(db *sql.DB) *Store {
	return &Store{db: db}
}

func (s *Store) List() ([]Server, error) {
	rows, err := s.db.Query(`
SELECT id, name, host, port, username, remark, created_at, updated_at
FROM servers
ORDER BY created_at DESC
`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]Server, 0)
	for rows.Next() {
		server, err := scanServer(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, server)
	}
	return out, rows.Err()
}

func (s *Store) Get(id string) (Server, error) {
	row := s.db.QueryRow(`
SELECT id, name, host, port, username, remark, created_at, updated_at
FROM servers WHERE id = ?
`, id)
	server, err := scanServer(row)
	if errors.Is(err, sql.ErrNoRows) {
		return Server{}, ErrNotFound
	}
	return server, err
}

func (s *Store) Create(input Input) (Server, error) {
	if err := validate(input); err != nil {
		return Server{}, err
	}
	now := time.Now().UTC().Format(time.RFC3339Nano)
	server := Server{
		ID:        ulid.Make().String(),
		Name:      strings.TrimSpace(input.Name),
		Host:      strings.TrimSpace(input.Host),
		Port:      input.Port,
		Username:  strings.TrimSpace(input.Username),
		Remark:    normalizeRemark(input.Remark),
		CreatedAt: now,
		UpdatedAt: now,
	}

	_, err := s.db.Exec(`
INSERT INTO servers (id, name, host, port, username, remark, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`, server.ID, server.Name, server.Host, server.Port, server.Username, remarkValue(server.Remark), server.CreatedAt, server.UpdatedAt)
	if err != nil {
		return Server{}, err
	}
	return server, nil
}

func (s *Store) Update(id string, input Input) (Server, error) {
	if err := validate(input); err != nil {
		return Server{}, err
	}
	existing, err := s.Get(id)
	if err != nil {
		return Server{}, err
	}

	existing.Name = strings.TrimSpace(input.Name)
	existing.Host = strings.TrimSpace(input.Host)
	existing.Port = input.Port
	existing.Username = strings.TrimSpace(input.Username)
	existing.Remark = normalizeRemark(input.Remark)
	existing.UpdatedAt = time.Now().UTC().Format(time.RFC3339Nano)

	res, err := s.db.Exec(`
UPDATE servers
SET name = ?, host = ?, port = ?, username = ?, remark = ?, updated_at = ?
WHERE id = ?
`, existing.Name, existing.Host, existing.Port, existing.Username, remarkValue(existing.Remark), existing.UpdatedAt, id)
	if err != nil {
		return Server{}, err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return Server{}, ErrNotFound
	}
	return existing, nil
}

func (s *Store) Delete(id string) error {
	res, err := s.db.Exec(`DELETE FROM servers WHERE id = ?`, id)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

func validate(input Input) error {
	if strings.TrimSpace(input.Name) == "" {
		return fmt.Errorf("%w: name is required", ErrValidation)
	}
	if strings.TrimSpace(input.Host) == "" {
		return fmt.Errorf("%w: host is required", ErrValidation)
	}
	if input.Port < 1 || input.Port > 65535 {
		return fmt.Errorf("%w: port must be between 1 and 65535", ErrValidation)
	}
	if strings.TrimSpace(input.Username) == "" {
		return fmt.Errorf("%w: username is required", ErrValidation)
	}
	return nil
}

func normalizeRemark(remark *string) *string {
	if remark == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*remark)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func remarkValue(remark *string) any {
	if remark == nil {
		return nil
	}
	return *remark
}

type rowScanner interface {
	Scan(dest ...any) error
}

func scanServer(row rowScanner) (Server, error) {
	var server Server
	var remark sql.NullString
	err := row.Scan(
		&server.ID,
		&server.Name,
		&server.Host,
		&server.Port,
		&server.Username,
		&remark,
		&server.CreatedAt,
		&server.UpdatedAt,
	)
	if err != nil {
		return Server{}, err
	}
	if remark.Valid {
		server.Remark = &remark.String
	}
	return server, nil
}
