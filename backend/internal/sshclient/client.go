package sshclient

import (
	"fmt"
	"os"
	"sync"
	"time"

	"golang.org/x/crypto/ssh"

	"github.com/zorth44/zorth-deploy-hub/backend/internal/servers"
)

// Client dials SSH targets using the shared private key.
type Client struct {
	privateKeyPath string

	mu     sync.Mutex
	signer ssh.Signer
}

func New(privateKeyPath string) *Client {
	return &Client{privateKeyPath: privateKeyPath}
}

func (c *Client) Dial(server servers.Server) (*ssh.Client, error) {
	signer, err := c.getSigner()
	if err != nil {
		return nil, err
	}

	config := &ssh.ClientConfig{
		User: server.Username,
		Auth: []ssh.AuthMethod{
			ssh.PublicKeys(signer),
		},
		HostKeyCallback: ssh.InsecureIgnoreHostKey(), //nolint:gosec // MVP matches current terminal behavior
		Timeout:         20 * time.Second,
	}

	addr := fmt.Sprintf("%s:%d", server.Host, server.Port)
	client, err := ssh.Dial("tcp", addr, config)
	if err != nil {
		return nil, fmt.Errorf("SSH connect failed: %w", err)
	}
	return client, nil
}

func (c *Client) getSigner() (ssh.Signer, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.signer != nil {
		return c.signer, nil
	}
	keyBytes, err := os.ReadFile(c.privateKeyPath)
	if err != nil {
		return nil, fmt.Errorf("read SSH private key: %w", err)
	}
	signer, err := ssh.ParsePrivateKey(keyBytes)
	if err != nil {
		return nil, fmt.Errorf("parse SSH private key: %w", err)
	}
	c.signer = signer
	return signer, nil
}
