package files

import (
	"errors"
	"fmt"
	"io"
	"os"
	"path"
	"sort"
	"strings"
	"time"

	"github.com/pkg/sftp"

	"github.com/zorth44/zorth-deploy-hub/backend/internal/servers"
	"github.com/zorth44/zorth-deploy-hub/backend/internal/sshclient"
)

var (
	ErrBadPath  = errors.New("invalid path")
	ErrNotFound = errors.New("not found")
	ErrIsDir    = errors.New("is a directory")
	ErrNotDir   = errors.New("not a directory")
	ErrNotEmpty = errors.New("directory not empty")
	ErrTooLarge = errors.New("file too large")
)

type Service struct {
	store          *servers.Store
	ssh            *sshclient.Client
	maxUploadBytes int64
}

func NewService(store *servers.Store, sshClient *sshclient.Client, maxUploadBytes int64) *Service {
	if maxUploadBytes <= 0 {
		maxUploadBytes = 200 << 20 // 200 MiB
	}
	return &Service{
		store:          store,
		ssh:            sshClient,
		maxUploadBytes: maxUploadBytes,
	}
}

func (s *Service) MaxUploadBytes() int64 {
	return s.maxUploadBytes
}

type Entry struct {
	Name    string    `json:"name"`
	Path    string    `json:"path"`
	IsDir   bool      `json:"isDir"`
	Size    int64     `json:"size"`
	Mode    string    `json:"mode"`
	ModTime time.Time `json:"modTime"`
}

type ListResult struct {
	Path    string  `json:"path"`
	Entries []Entry `json:"entries"`
}

type session struct {
	ssh  io.Closer
	sftp *sftp.Client
}

func (s *Service) open(serverID string) (servers.Server, *session, error) {
	server, err := s.store.Get(serverID)
	if err != nil {
		return servers.Server{}, nil, err
	}
	sshConn, err := s.ssh.Dial(server)
	if err != nil {
		return servers.Server{}, nil, err
	}
	sftpClient, err := sftp.NewClient(sshConn)
	if err != nil {
		_ = sshConn.Close()
		return servers.Server{}, nil, fmt.Errorf("SFTP open failed: %w", err)
	}
	return server, &session{ssh: sshConn, sftp: sftpClient}, nil
}

func (sess *session) Close() {
	_ = sess.sftp.Close()
	_ = sess.ssh.Close()
}

func normalizePath(raw string) (string, error) {
	if strings.ContainsRune(raw, 0) {
		return "", ErrBadPath
	}
	cleaned := path.Clean("/" + strings.TrimSpace(raw))
	if cleaned == "." {
		cleaned = "/"
	}
	if !strings.HasPrefix(cleaned, "/") {
		cleaned = "/" + cleaned
	}
	return cleaned, nil
}

func resolvePath(client *sftp.Client, raw string) (string, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" || trimmed == "~" {
		wd, err := client.Getwd()
		if err != nil {
			return "", err
		}
		return normalizePath(wd)
	}
	if strings.HasPrefix(trimmed, "~/") {
		wd, err := client.Getwd()
		if err != nil {
			return "", err
		}
		return normalizePath(path.Join(wd, strings.TrimPrefix(trimmed, "~/")))
	}
	if strings.HasPrefix(trimmed, "/") {
		return normalizePath(trimmed)
	}
	wd, err := client.Getwd()
	if err != nil {
		return "", err
	}
	return normalizePath(path.Join(wd, trimmed))
}

func (s *Service) List(serverID, rawPath string) (ListResult, error) {
	_, sess, err := s.open(serverID)
	if err != nil {
		return ListResult{}, err
	}
	defer sess.Close()

	dir, err := resolvePath(sess.sftp, rawPath)
	if err != nil {
		return ListResult{}, err
	}

	info, err := sess.sftp.Stat(dir)
	if err != nil {
		if os.IsNotExist(err) {
			return ListResult{}, ErrNotFound
		}
		return ListResult{}, err
	}
	if !info.IsDir() {
		return ListResult{}, ErrNotDir
	}

	entries, err := sess.sftp.ReadDir(dir)
	if err != nil {
		return ListResult{}, err
	}

	result := ListResult{
		Path:    dir,
		Entries: make([]Entry, 0, len(entries)+1),
	}
	if dir != "/" {
		result.Entries = append(result.Entries, Entry{
			Name:  "..",
			Path:  path.Dir(dir),
			IsDir: true,
		})
	}

	for _, e := range entries {
		name := e.Name()
		if name == "." || name == ".." {
			continue
		}
		result.Entries = append(result.Entries, Entry{
			Name:    name,
			Path:    path.Join(dir, name),
			IsDir:   e.IsDir(),
			Size:    e.Size(),
			Mode:    e.Mode().String(),
			ModTime: e.ModTime().UTC(),
		})
	}

	sort.SliceStable(result.Entries, func(i, j int) bool {
		a, b := result.Entries[i], result.Entries[j]
		if a.Name == ".." {
			return true
		}
		if b.Name == ".." {
			return false
		}
		if a.IsDir != b.IsDir {
			return a.IsDir
		}
		return strings.ToLower(a.Name) < strings.ToLower(b.Name)
	})

	return result, nil
}

func (s *Service) Mkdir(serverID, rawPath string) error {
	_, sess, err := s.open(serverID)
	if err != nil {
		return err
	}
	defer sess.Close()

	dir, err := resolvePath(sess.sftp, rawPath)
	if err != nil {
		return err
	}
	if err := sess.sftp.MkdirAll(dir); err != nil {
		return err
	}
	return nil
}

func (s *Service) Delete(serverID, rawPath string, recursive bool) error {
	_, sess, err := s.open(serverID)
	if err != nil {
		return err
	}
	defer sess.Close()

	target, err := resolvePath(sess.sftp, rawPath)
	if err != nil {
		return err
	}
	if target == "/" {
		return ErrBadPath
	}

	info, err := sess.sftp.Stat(target)
	if err != nil {
		if os.IsNotExist(err) {
			return ErrNotFound
		}
		return err
	}

	if !info.IsDir() {
		return sess.sftp.Remove(target)
	}

	if !recursive {
		entries, readErr := sess.sftp.ReadDir(target)
		if readErr != nil {
			return readErr
		}
		if hasNonDotEntries(entries) {
			return ErrNotEmpty
		}
		return sess.sftp.RemoveDirectory(target)
	}

	return removeAll(sess.sftp, target)
}

// sftpRemover is the subset of *sftp.Client used by removeAll.
type sftpRemover interface {
	ReadDir(path string) ([]os.FileInfo, error)
	Lstat(path string) (os.FileInfo, error)
	Remove(path string) error
	RemoveDirectory(path string) error
}

func hasNonDotEntries(entries []os.FileInfo) bool {
	for _, e := range entries {
		name := e.Name()
		if name == "." || name == ".." {
			continue
		}
		return true
	}
	return false
}

// removeAll deletes target recursively without following directory symlinks.
// It is iterative so deep trees and SFTP servers that return "." / ".." cannot
// overflow the goroutine stack (a recursive walk on "." would call itself forever).
func removeAll(client sftpRemover, root string) error {
	stack := []string{root}
	seen := map[string]struct{}{root: {}}
	var dirs []string

	for len(stack) > 0 {
		dir := stack[len(stack)-1]
		stack = stack[:len(stack)-1]
		dirs = append(dirs, dir)

		entries, err := client.ReadDir(dir)
		if err != nil {
			return err
		}
		for _, e := range entries {
			name := e.Name()
			if name == "." || name == ".." {
				continue
			}
			child := path.Join(dir, name)

			info, err := client.Lstat(child)
			if err != nil {
				if os.IsNotExist(err) {
					continue
				}
				return err
			}

			// Symlinks (even to directories) are removed as leaf nodes so cycles
			// cannot pull the walk into another tree forever.
			if info.Mode()&os.ModeSymlink != 0 || !info.IsDir() {
				if err := client.Remove(child); err != nil && !os.IsNotExist(err) {
					return err
				}
				continue
			}

			if _, ok := seen[child]; ok {
				continue
			}
			seen[child] = struct{}{}
			stack = append(stack, child)
		}
	}

	for i := len(dirs) - 1; i >= 0; i-- {
		if err := client.RemoveDirectory(dirs[i]); err != nil && !os.IsNotExist(err) {
			return err
		}
	}
	return nil
}

func (s *Service) Download(serverID, rawPath string) (string, int64, io.ReadCloser, func(), error) {
	_, sess, err := s.open(serverID)
	if err != nil {
		return "", 0, nil, nil, err
	}

	closeSess := sess.Close
	target, err := resolvePath(sess.sftp, rawPath)
	if err != nil {
		closeSess()
		return "", 0, nil, nil, err
	}

	info, err := sess.sftp.Stat(target)
	if err != nil {
		closeSess()
		if os.IsNotExist(err) {
			return "", 0, nil, nil, ErrNotFound
		}
		return "", 0, nil, nil, err
	}
	if info.IsDir() {
		closeSess()
		return "", 0, nil, nil, ErrIsDir
	}
	if info.Size() > s.maxUploadBytes {
		closeSess()
		return "", 0, nil, nil, ErrTooLarge
	}

	f, err := sess.sftp.Open(target)
	if err != nil {
		closeSess()
		return "", 0, nil, nil, err
	}

	return path.Base(target), info.Size(), f, func() {
		_ = f.Close()
		closeSess()
	}, nil
}

func (s *Service) Upload(serverID, dirPath, fileName string, r io.Reader, size int64) error {
	if strings.Contains(fileName, "/") || strings.Contains(fileName, "\\") || fileName == "" || fileName == "." || fileName == ".." {
		return ErrBadPath
	}
	if size > s.maxUploadBytes {
		return ErrTooLarge
	}

	_, sess, err := s.open(serverID)
	if err != nil {
		return err
	}
	defer sess.Close()

	dir, err := resolvePath(sess.sftp, dirPath)
	if err != nil {
		return err
	}
	info, err := sess.sftp.Stat(dir)
	if err != nil {
		if os.IsNotExist(err) {
			return ErrNotFound
		}
		return err
	}
	if !info.IsDir() {
		return ErrNotDir
	}

	target := path.Join(dir, fileName)
	limited := io.LimitReader(r, s.maxUploadBytes+1)
	f, err := sess.sftp.OpenFile(target, os.O_WRONLY|os.O_CREATE|os.O_TRUNC)
	if err != nil {
		return err
	}
	defer f.Close()

	written, err := io.Copy(f, limited)
	if err != nil {
		_ = sess.sftp.Remove(target)
		return err
	}
	if written > s.maxUploadBytes {
		_ = sess.sftp.Remove(target)
		return ErrTooLarge
	}
	return nil
}

func (s *Service) Exists(serverID, dirPath, fileName string) (bool, error) {
	if strings.Contains(fileName, "/") || strings.Contains(fileName, "\\") || fileName == "" {
		return false, ErrBadPath
	}
	_, sess, err := s.open(serverID)
	if err != nil {
		return false, err
	}
	defer sess.Close()

	dir, err := resolvePath(sess.sftp, dirPath)
	if err != nil {
		return false, err
	}
	_, err = sess.sftp.Stat(path.Join(dir, fileName))
	if err != nil {
		if os.IsNotExist(err) {
			return false, nil
		}
		return false, err
	}
	return true, nil
}
