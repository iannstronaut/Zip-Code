import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { Header } from './Header.js';
import { MessageView } from './MessageView.js';
import { StatusBar } from './StatusBar.js';
import { InputBar } from './InputBar.js';
import { SettingsPanel } from './SettingsPanel.js';
import { SessionList } from './SessionList.js';
import { Banner } from './Banner.js';
import { Agent, type AgentEvent } from '../agent.js';
import {
  loadConfigSync,
  getProviderInfo,
  type AppConfig,
} from '../config.js';
import { listSessions } from '../store.js';
import type { ChatMessage, SessionRow } from '../types.js';

type Modal = 'none' | 'settings' | 'sessions';

export function App(): JSX.Element {
  const { exit } = useApp();
  const [config, setConfig] = useState<AppConfig>(() => loadConfigSync());
  const [agent, setAgent] = useState<Agent | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [thinking, setThinking] = useState(false);
  const [pendingTools, setPendingTools] = useState(0);
  const [modal, setModal] = useState<Modal>('none');
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sessionTitle, setSessionTitle] = useState('New session');
  const [showBanner, setShowBanner] = useState(true);

  const agentRef = useRef<Agent | null>(null);

  // Bootstrap agent
  useEffect(() => {
    let cancelled = false;
    Agent.create()
      .then((a) => {
        if (cancelled) return;
        agentRef.current = a;
        setAgent(a);
        setMessages(a.getMessages());
      })
      .catch((e) => {
        setError(e?.message || 'Failed to start agent');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Subscribe to agent events
  useEffect(() => {
    if (!agent) return;
    const handler = (event: AgentEvent) => {
      switch (event.type) {
        case 'message': {
          setMessages((prev) => {
            const idx = prev.findIndex((m) => m.id === event.message.id);
            if (idx >= 0) {
              const next = prev.slice();
              next[idx] = { ...event.message };
              return next;
            }
            return [...prev, event.message];
          });
          if (event.message.role === 'user') setShowBanner(false);
          break;
        }
        case 'message_delta': {
          setMessages((prev) => {
            const idx = prev.findIndex((m) => m.id === event.id);
            if (idx < 0) return prev;
            const next = prev.slice();
            next[idx] = {
              ...next[idx],
              content: next[idx].content + event.delta,
            };
            return next;
          });
          break;
        }
        case 'message_done': {
          setMessages((prev) => {
            const idx = prev.findIndex((m) => m.id === event.id);
            if (idx < 0) return prev;
            const next = prev.slice();
            next[idx] = { ...next[idx], streaming: false };
            return next;
          });
          break;
        }
        case 'tool_start': {
          setPendingTools((n) => n + 1);
          setMessages((prev) => {
            const idx = prev.findIndex((m) => m.id === event.message.id);
            if (idx >= 0) {
              const next = prev.slice();
              next[idx] = { ...event.message };
              return next;
            }
            return [...prev, event.message];
          });
          break;
        }
        case 'tool_end': {
          setPendingTools((n) => Math.max(0, n - 1));
          setMessages((prev) => {
            const idx = prev.findIndex((m) => m.id === event.message.id);
            if (idx < 0) return [...prev, event.message];
            const next = prev.slice();
            next[idx] = { ...event.message };
            return next;
          });
          break;
        }
        case 'thinking': {
          setThinking(event.on);
          break;
        }
        case 'error': {
          setError(event.message);
          break;
        }
        case 'session': {
          setMessages(agent.getMessages());
          break;
        }
        case 'done':
          break;
      }
    };
    agent.on('event', handler);
    return () => {
      agent.off('event', handler);
    };
  }, [agent]);

  // Global keybinds
  useInput(
    useCallback(
      (inputCh: string, key: any) => {
        // Ctrl+C — quit
        if (key.ctrl && (inputCh === 'c' || inputCh === '\u0003')) {
          exit();
          return;
        }
        // Ctrl+S — settings (works globally)
        if (key.ctrl && inputCh === 's') {
          setModal((m) => (m === 'settings' ? 'none' : 'settings'));
          return;
        }
        // Ctrl+L — sessions list
        if (key.ctrl && inputCh === 'l') {
          if (modal !== 'sessions') {
            setSessions(listSessions());
          }
          setModal((m) => (m === 'sessions' ? 'none' : 'sessions'));
          return;
        }
        // Ctrl+N — new session
        if (key.ctrl && inputCh === 'n') {
          handleNewSession();
          return;
        }
        // Esc when busy → cancel
        if (key.escape && (thinking || pendingTools > 0)) {
          agent?.cancel();
          return;
        }
      },
      [agent, modal, thinking, pendingTools, exit]
    )
  );

  const handleSubmit = (value: string) => {
    const v = value.trim();
    if (!v || !agent) return;
    setInput('');
    setError(null);

    // Slash commands
    if (v === '/quit' || v === '/exit') {
      exit();
      return;
    }
    if (v === '/help') {
      // Show help by inserting an assistant-style message.
      const helpMsg: ChatMessage = {
        id: `help_${Date.now()}`,
        role: 'assistant',
        content: HELP_TEXT,
        createdAt: Date.now(),
      };
      setMessages((p) => [...p, helpMsg]);
      return;
    }
    if (v === '/clear') {
      setMessages([]);
      return;
    }
    if (v === '/new') {
      handleNewSession();
      return;
    }
    if (v === '/sessions') {
      setSessions(listSessions());
      setModal('sessions');
      return;
    }
    if (v === '/settings') {
      setModal('settings');
      return;
    }

    void agent.send(v);
  };

  function handleNewSession() {
    if (!agent) return;
    void agent.newSession().then(() => {
      setMessages([]);
      setSessionTitle('New session');
      setShowBanner(true);
    });
  }

  function handleSelectSession(id: string) {
    if (!agent) return;
    void agent.switchSession(id).then(() => {
      const s = listSessions().find((x) => x.id === id);
      if (s) setSessionTitle(s.title);
      setShowBanner(false);
      setModal('none');
    });
  }

  async function handleSavedConfig(next: AppConfig) {
    setConfig(next);
    if (agent) {
      await agent.reinitialize(next);
    }
  }

  const cwd = process.cwd();

  return (
    <Box flexDirection="column">
      {showBanner ? <Banner subtitle="AI coding agent · Ctrl+S settings · Ctrl+L sessions" /> : null}

      <Header
        providerName={config.provider.name}
        model={config.provider.model || '(no model)'}
        cwd={cwd}
        sessionTitle={sessionTitle}
      />

      {!config.apiKey ? (
        <Box paddingX={1}>
          <Text color="yellow">
            ⚠ {getProviderInfo(config)}
          </Text>
        </Box>
      ) : null}

      <MessageView messages={messages} />

      <InputBar
        value={input}
        onChange={setInput}
        onSubmit={handleSubmit}
        disabled={modal !== 'none' || thinking}
        placeholder={
          thinking
            ? 'Working… press Esc to cancel'
            : 'Type a message or /help…'
        }
      />

      <StatusBar
        thinking={thinking}
        pendingTools={pendingTools}
        error={error || undefined}
      />

      {modal === 'settings' ? (
        <Box flexDirection="column" marginTop={1}>
          <SettingsPanel
            initial={config}
            onSaved={handleSavedConfig}
            onClose={() => setModal('none')}
          />
        </Box>
      ) : null}

      {modal === 'sessions' ? (
        <Box flexDirection="column" marginTop={1}>
          <SessionList
            sessions={sessions}
            currentSessionId={agent?.getSessionId() || ''}
            onSelect={handleSelectSession}
            onNew={() => {
              handleNewSession();
              setModal('none');
            }}
            onCancel={() => setModal('none')}
          />
        </Box>
      ) : null}
    </Box>
  );
}

const HELP_TEXT = `## Commands

- \`/help\` — show this help
- \`/new\` — start a new session
- \`/sessions\` — open the session list
- \`/settings\` — open settings
- \`/clear\` — clear visible messages
- \`/quit\`, \`/exit\` — quit

## Keybinds

- **Enter** — send message
- **Ctrl+S** — toggle settings panel
- **Ctrl+L** — toggle session list
- **Ctrl+N** — start a new session
- **Esc** — cancel an in-flight request
- **Ctrl+C** — quit
`;
