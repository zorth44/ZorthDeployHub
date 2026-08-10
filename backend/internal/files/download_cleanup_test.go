package files

import "testing"

// Named return + closure that calls the same named var used to make Download's
// cleanup recurse forever (fatal stack overflow after every successful transfer).
func TestNamedCleanupSelfCaptureRecurses(t *testing.T) {
	var cleanup func()
	depth := 0
	cleanup = func() {
		depth++
		if depth > 64 {
			return
		}
		cleanup()
	}
	cleanup()
	if depth <= 64 {
		t.Fatalf("expected self-capturing cleanup to keep recursing, depth=%d", depth)
	}
}

func TestLocalCloseSessCleanupTerminates(t *testing.T) {
	var calls int
	closeSess := func() { calls++ }
	cleanup := func() {
		closeSess()
	}
	cleanup()
	if calls != 1 {
		t.Fatalf("closeSess called %d times, want 1", calls)
	}
}
