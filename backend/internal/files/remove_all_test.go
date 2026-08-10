package files

import (
	"io/fs"
	"os"
	"path"
	"testing"
	"time"
)

type memInfo struct {
	name string
	mode os.FileMode
}

func (m memInfo) Name() string       { return m.name }
func (m memInfo) Size() int64        { return 0 }
func (m memInfo) Mode() os.FileMode  { return m.mode }
func (m memInfo) ModTime() time.Time { return time.Time{} }
func (m memInfo) IsDir() bool        { return m.mode.IsDir() }
func (m memInfo) Sys() any           { return nil }

type memFS struct {
	dirs  map[string][]os.FileInfo
	nodes map[string]os.FileMode
}

func newMemFS() *memFS {
	return &memFS{
		dirs:  map[string][]os.FileInfo{},
		nodes: map[string]os.FileMode{},
	}
}

func (m *memFS) addDir(p string, entries ...os.FileInfo) {
	m.nodes[p] = fs.ModeDir | 0o755
	m.dirs[p] = entries
	for _, e := range entries {
		child := path.Join(p, e.Name())
		if e.Name() == "." || e.Name() == ".." {
			continue
		}
		m.nodes[child] = e.Mode()
		if e.IsDir() && m.dirs[child] == nil {
			m.dirs[child] = nil
		}
	}
}

func (m *memFS) ReadDir(p string) ([]os.FileInfo, error) {
	entries, ok := m.dirs[p]
	if !ok {
		return nil, os.ErrNotExist
	}
	return entries, nil
}

func (m *memFS) Lstat(p string) (os.FileInfo, error) {
	mode, ok := m.nodes[p]
	if !ok {
		return nil, os.ErrNotExist
	}
	return memInfo{name: path.Base(p), mode: mode}, nil
}

func (m *memFS) Remove(p string) error {
	if _, ok := m.nodes[p]; !ok {
		return os.ErrNotExist
	}
	delete(m.nodes, p)
	return nil
}

func (m *memFS) RemoveDirectory(p string) error {
	if _, ok := m.nodes[p]; !ok {
		return os.ErrNotExist
	}
	delete(m.nodes, p)
	delete(m.dirs, p)
	return nil
}

func TestRemoveAllSkipsDotEntries(t *testing.T) {
	fsys := newMemFS()
	// OpenSSH-style listing includes "." and "..". A recursive walk that
	// follows "." will call removeAll on the same path forever and stack overflow.
	fsys.addDir("/tmp/demo",
		memInfo{name: ".", mode: fs.ModeDir | 0o755},
		memInfo{name: "..", mode: fs.ModeDir | 0o755},
		memInfo{name: "child", mode: fs.ModeDir | 0o755},
		memInfo{name: "file.txt", mode: 0o644},
	)
	fsys.addDir("/tmp/demo/child",
		memInfo{name: ".", mode: fs.ModeDir | 0o755},
		memInfo{name: "..", mode: fs.ModeDir | 0o755},
		memInfo{name: "nested.txt", mode: 0o644},
	)

	done := make(chan error, 1)
	go func() {
		done <- removeAll(fsys, "/tmp/demo")
	}()

	select {
	case err := <-done:
		if err != nil {
			t.Fatalf("removeAll: %v", err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("removeAll hung or recursed too deep (likely followed \".\")")
	}

	if len(fsys.nodes) != 0 {
		t.Fatalf("expected empty fs, leftover nodes: %#v", fsys.nodes)
	}
}

func TestRemoveAllDoesNotFollowSymlinkDirs(t *testing.T) {
	fsys := newMemFS()
	fsys.addDir("/tmp/demo",
		memInfo{name: ".", mode: fs.ModeDir | 0o755},
		memInfo{name: "..", mode: fs.ModeDir | 0o755},
		memInfo{name: "link", mode: fs.ModeSymlink | 0o777},
		memInfo{name: "file.txt", mode: 0o644},
	)
	// If the walk followed the symlink as a directory, a cycle back to /tmp/demo
	// would recurse forever. Lstat keeps "link" as a leaf remove.
	fsys.nodes["/tmp/demo/link"] = fs.ModeSymlink | 0o777

	if err := removeAll(fsys, "/tmp/demo"); err != nil {
		t.Fatalf("removeAll: %v", err)
	}
	if len(fsys.nodes) != 0 {
		t.Fatalf("expected empty fs, leftover nodes: %#v", fsys.nodes)
	}
}

func TestHasNonDotEntries(t *testing.T) {
	if hasNonDotEntries([]os.FileInfo{
		memInfo{name: ".", mode: fs.ModeDir},
		memInfo{name: "..", mode: fs.ModeDir},
	}) {
		t.Fatal("dot-only listing should be treated as empty")
	}
	if !hasNonDotEntries([]os.FileInfo{
		memInfo{name: ".", mode: fs.ModeDir},
		memInfo{name: "a", mode: 0o644},
	}) {
		t.Fatal("expected non-dot entry")
	}
}
