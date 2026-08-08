package servers

import (
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/oklog/ulid/v2"

	"github.com/zorth44/zorth-deploy-hub/backend/internal/groups"
	"github.com/zorth44/zorth-deploy-hub/backend/internal/tags"
)

var ErrNotFound = errors.New("server not found")
var ErrValidation = errors.New("validation error")

type Server struct {
	ID        string        `json:"id"`
	Name      string        `json:"name"`
	Host      string        `json:"host"`
	Port      int           `json:"port"`
	Username  string        `json:"username"`
	Remark    *string       `json:"remark"`
	GroupID   *string       `json:"groupId"`
	Group     *groups.Group `json:"group"`
	Tags      []tags.Tag    `json:"tags"`
	CreatedAt string        `json:"createdAt"`
	UpdatedAt string        `json:"updatedAt"`
}

type Input struct {
	Name     string   `json:"name"`
	Host     string   `json:"host"`
	Port     int      `json:"port"`
	Username string   `json:"username"`
	Remark   *string  `json:"remark"`
	GroupID  *string  `json:"groupId"`
	TagIDs   []string `json:"tagIds"`
}

type Store struct {
	db *sql.DB
}

func NewStore(db *sql.DB) *Store {
	return &Store{db: db}
}

func (s *Store) List() ([]Server, error) {
	rows, err := s.db.Query(`
SELECT
  s.id, s.name, s.host, s.port, s.username, s.remark, s.group_id, s.created_at, s.updated_at,
  g.id, g.name, g.color, g.created_at, g.updated_at
FROM servers s
LEFT JOIN groups g ON g.id = s.group_id
ORDER BY s.created_at DESC
`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]Server, 0)
	ids := make([]string, 0)
	for rows.Next() {
		server, err := scanServer(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, server)
		ids = append(ids, server.ID)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	tagMap, err := s.tagsForServers(ids)
	if err != nil {
		return nil, err
	}
	for i := range out {
		if tagsForServer, ok := tagMap[out[i].ID]; ok {
			out[i].Tags = tagsForServer
		} else {
			out[i].Tags = []tags.Tag{}
		}
	}
	return out, nil
}

func (s *Store) Get(id string) (Server, error) {
	row := s.db.QueryRow(`
SELECT
  s.id, s.name, s.host, s.port, s.username, s.remark, s.group_id, s.created_at, s.updated_at,
  g.id, g.name, g.color, g.created_at, g.updated_at
FROM servers s
LEFT JOIN groups g ON g.id = s.group_id
WHERE s.id = ?
`, id)
	server, err := scanServer(row)
	if errors.Is(err, sql.ErrNoRows) {
		return Server{}, ErrNotFound
	}
	if err != nil {
		return Server{}, err
	}
	tagMap, err := s.tagsForServers([]string{id})
	if err != nil {
		return Server{}, err
	}
	if tagsForServer, ok := tagMap[id]; ok {
		server.Tags = tagsForServer
	} else {
		server.Tags = []tags.Tag{}
	}
	return server, nil
}

func (s *Store) Create(input Input) (Server, error) {
	if err := validate(input); err != nil {
		return Server{}, err
	}
	groupID, err := s.normalizeGroupID(input.GroupID)
	if err != nil {
		return Server{}, err
	}
	tagIDs, err := s.normalizeTagIDs(input.TagIDs)
	if err != nil {
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
		GroupID:   groupID,
		CreatedAt: now,
		UpdatedAt: now,
	}

	tx, err := s.db.Begin()
	if err != nil {
		return Server{}, err
	}
	defer func() { _ = tx.Rollback() }()

	_, err = tx.Exec(`
INSERT INTO servers (id, name, host, port, username, remark, group_id, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`, server.ID, server.Name, server.Host, server.Port, server.Username, remarkValue(server.Remark), nullableString(groupID), server.CreatedAt, server.UpdatedAt)
	if err != nil {
		return Server{}, err
	}
	if err := replaceServerTags(tx, server.ID, tagIDs); err != nil {
		return Server{}, err
	}
	if err := tx.Commit(); err != nil {
		return Server{}, err
	}
	return s.Get(server.ID)
}

func (s *Store) Update(id string, input Input) (Server, error) {
	if err := validate(input); err != nil {
		return Server{}, err
	}
	if _, err := s.Get(id); err != nil {
		return Server{}, err
	}
	groupID, err := s.normalizeGroupID(input.GroupID)
	if err != nil {
		return Server{}, err
	}
	tagIDs, err := s.normalizeTagIDs(input.TagIDs)
	if err != nil {
		return Server{}, err
	}

	now := time.Now().UTC().Format(time.RFC3339Nano)
	tx, err := s.db.Begin()
	if err != nil {
		return Server{}, err
	}
	defer func() { _ = tx.Rollback() }()

	res, err := tx.Exec(`
UPDATE servers
SET name = ?, host = ?, port = ?, username = ?, remark = ?, group_id = ?, updated_at = ?
WHERE id = ?
`, strings.TrimSpace(input.Name), strings.TrimSpace(input.Host), input.Port, strings.TrimSpace(input.Username), remarkValue(normalizeRemark(input.Remark)), nullableString(groupID), now, id)
	if err != nil {
		return Server{}, err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return Server{}, ErrNotFound
	}
	if err := replaceServerTags(tx, id, tagIDs); err != nil {
		return Server{}, err
	}
	if err := tx.Commit(); err != nil {
		return Server{}, err
	}
	return s.Get(id)
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

func (s *Store) tagsForServers(ids []string) (map[string][]tags.Tag, error) {
	out := make(map[string][]tags.Tag, len(ids))
	if len(ids) == 0 {
		return out, nil
	}

	placeholders := make([]string, len(ids))
	args := make([]any, len(ids))
	for i, id := range ids {
		placeholders[i] = "?"
		args[i] = id
	}

	query := fmt.Sprintf(`
SELECT st.server_id, t.id, t.name, t.color, t.created_at, t.updated_at
FROM server_tags st
JOIN tags t ON t.id = st.tag_id
WHERE st.server_id IN (%s)
ORDER BY t.name COLLATE NOCASE ASC
`, strings.Join(placeholders, ","))

	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var serverID string
		var tag tags.Tag
		if err := rows.Scan(&serverID, &tag.ID, &tag.Name, &tag.Color, &tag.CreatedAt, &tag.UpdatedAt); err != nil {
			return nil, err
		}
		out[serverID] = append(out[serverID], tag)
	}
	return out, rows.Err()
}

func replaceServerTags(tx *sql.Tx, serverID string, tagIDs []string) error {
	if _, err := tx.Exec(`DELETE FROM server_tags WHERE server_id = ?`, serverID); err != nil {
		return err
	}
	for _, tagID := range tagIDs {
		if _, err := tx.Exec(`INSERT INTO server_tags (server_id, tag_id) VALUES (?, ?)`, serverID, tagID); err != nil {
			return err
		}
	}
	return nil
}

func (s *Store) normalizeGroupID(groupID *string) (*string, error) {
	if groupID == nil {
		return nil, nil
	}
	trimmed := strings.TrimSpace(*groupID)
	if trimmed == "" {
		return nil, nil
	}
	var exists string
	err := s.db.QueryRow(`SELECT id FROM groups WHERE id = ?`, trimmed).Scan(&exists)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, fmt.Errorf("%w: group not found", ErrValidation)
	}
	if err != nil {
		return nil, err
	}
	return &trimmed, nil
}

func (s *Store) normalizeTagIDs(tagIDs []string) ([]string, error) {
	if len(tagIDs) == 0 {
		return []string{}, nil
	}
	seen := make(map[string]struct{}, len(tagIDs))
	out := make([]string, 0, len(tagIDs))
	for _, raw := range tagIDs {
		id := strings.TrimSpace(raw)
		if id == "" {
			continue
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		var exists string
		err := s.db.QueryRow(`SELECT id FROM tags WHERE id = ?`, id).Scan(&exists)
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("%w: tag not found", ErrValidation)
		}
		if err != nil {
			return nil, err
		}
		out = append(out, id)
	}
	return out, nil
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

func nullableString(value *string) any {
	if value == nil {
		return nil
	}
	return *value
}

type rowScanner interface {
	Scan(dest ...any) error
}

func scanServer(row rowScanner) (Server, error) {
	var server Server
	var remark sql.NullString
	var groupID sql.NullString
	var gID, gName, gColor, gCreated, gUpdated sql.NullString

	err := row.Scan(
		&server.ID,
		&server.Name,
		&server.Host,
		&server.Port,
		&server.Username,
		&remark,
		&groupID,
		&server.CreatedAt,
		&server.UpdatedAt,
		&gID,
		&gName,
		&gColor,
		&gCreated,
		&gUpdated,
	)
	if err != nil {
		return Server{}, err
	}
	if remark.Valid {
		server.Remark = &remark.String
	}
	if groupID.Valid {
		server.GroupID = &groupID.String
	}
	if gID.Valid {
		server.Group = &groups.Group{
			ID:        gID.String,
			Name:      gName.String,
			Color:     gColor.String,
			CreatedAt: gCreated.String,
			UpdatedAt: gUpdated.String,
		}
	}
	server.Tags = []tags.Tag{}
	return server, nil
}
