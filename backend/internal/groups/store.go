package groups

import (
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/oklog/ulid/v2"
)

var ErrNotFound = errors.New("group not found")
var ErrValidation = errors.New("validation error")
var ErrConflict = errors.New("conflict")

type Group struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Color     string `json:"color"`
	CreatedAt string `json:"createdAt"`
	UpdatedAt string `json:"updatedAt"`
}

type Input struct {
	Name  string `json:"name"`
	Color string `json:"color"`
}

type Store struct {
	db *sql.DB
}

func NewStore(db *sql.DB) *Store {
	return &Store{db: db}
}

func (s *Store) List() ([]Group, error) {
	rows, err := s.db.Query(`
SELECT id, name, color, created_at, updated_at
FROM groups
ORDER BY name COLLATE NOCASE ASC
`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]Group, 0)
	for rows.Next() {
		var g Group
		if err := rows.Scan(&g.ID, &g.Name, &g.Color, &g.CreatedAt, &g.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, g)
	}
	return out, rows.Err()
}

func (s *Store) Get(id string) (Group, error) {
	var g Group
	err := s.db.QueryRow(`
SELECT id, name, color, created_at, updated_at
FROM groups WHERE id = ?
`, id).Scan(&g.ID, &g.Name, &g.Color, &g.CreatedAt, &g.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return Group{}, ErrNotFound
	}
	return g, err
}

func (s *Store) Create(input Input) (Group, error) {
	name, color, err := validate(input)
	if err != nil {
		return Group{}, err
	}
	now := time.Now().UTC().Format(time.RFC3339Nano)
	g := Group{
		ID:        ulid.Make().String(),
		Name:      name,
		Color:     color,
		CreatedAt: now,
		UpdatedAt: now,
	}
	_, err = s.db.Exec(`
INSERT INTO groups (id, name, color, created_at, updated_at)
VALUES (?, ?, ?, ?, ?)
`, g.ID, g.Name, g.Color, g.CreatedAt, g.UpdatedAt)
	if err != nil {
		if isUniqueViolation(err) {
			return Group{}, fmt.Errorf("%w: group name already exists", ErrConflict)
		}
		return Group{}, err
	}
	return g, nil
}

func (s *Store) Update(id string, input Input) (Group, error) {
	name, color, err := validate(input)
	if err != nil {
		return Group{}, err
	}
	existing, err := s.Get(id)
	if err != nil {
		return Group{}, err
	}
	existing.Name = name
	existing.Color = color
	existing.UpdatedAt = time.Now().UTC().Format(time.RFC3339Nano)

	_, err = s.db.Exec(`
UPDATE groups SET name = ?, color = ?, updated_at = ? WHERE id = ?
`, existing.Name, existing.Color, existing.UpdatedAt, id)
	if err != nil {
		if isUniqueViolation(err) {
			return Group{}, fmt.Errorf("%w: group name already exists", ErrConflict)
		}
		return Group{}, err
	}
	return existing, nil
}

func (s *Store) Delete(id string) error {
	res, err := s.db.Exec(`DELETE FROM groups WHERE id = ?`, id)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

func validate(input Input) (string, string, error) {
	name := strings.TrimSpace(input.Name)
	if name == "" {
		return "", "", fmt.Errorf("%w: name is required", ErrValidation)
	}
	if len(name) > 64 {
		return "", "", fmt.Errorf("%w: name must be at most 64 characters", ErrValidation)
	}
	color := strings.TrimSpace(input.Color)
	if color == "" {
		color = "#64748b"
	}
	if !isHexColor(color) {
		return "", "", fmt.Errorf("%w: color must be a hex value like #64748b", ErrValidation)
	}
	return name, strings.ToLower(color), nil
}

func isHexColor(color string) bool {
	if len(color) != 7 || color[0] != '#' {
		return false
	}
	for i := 1; i < 7; i++ {
		c := color[i]
		if (c < '0' || c > '9') && (c < 'a' || c > 'f') && (c < 'A' || c > 'F') {
			return false
		}
	}
	return true
}

func isUniqueViolation(err error) bool {
	return err != nil && strings.Contains(strings.ToLower(err.Error()), "unique")
}
