import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { Header } from './Header.js';
import { MessageView } from './MessageView.js';
import { StatusBar } from './StatusBar.js';
import { InputBar } from './InputBar.js';
import { SettingsPanel } from './SettingsPanel.js';
import { SessionList } from './SessionList.js';
import { Banner } from './Banner.js';
import { ToolsPanel } from './ToolsPanel.js';
import { ProfilesPanel } from './ProfilesPanel.js';
import { TemplatesPanel } from './TemplatesPanel.js';
import { BudgetPanel } from './BudgetPanel.js';
import { MemoryPanel } from './MemoryPanel.js';
import { MCPPanel } from './MCPPanel.js';
import { ExportPanel } from './ExportPanel.js';
import { Agent, type AgentEvent } from '../agent.js';
import {
  loadConfigSync,
  getProviderInfo,
  type AppConfig,
} from '../config.js';
import { listSessions } from '../store.js';
import { TOOLS } from '../tools.js';
import { mcpManager } from '../mcp-client.js';
import { budgetGuard } from '../budget-guard.js';
import { promptTemplates } from '../prompt-templates.js';
import type { ChatMessage, SessionRow } from '../types.js';

type Modal =
  | 'none'
  | 'settings'
  | 'sessions'
  | 'tools'
  | 'profiles'
  | 'templates'
  | 'budget'
  | 'memory'
  | 'mcp'
  | 'export';

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
  const [budgetSnapshot, setBudgetSnapshot] = useState(() => budgetGuard.snapshot());
  const [mcpServerCount, setMcpServerCount] = useState(0);

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

  // Refresh budget + mcp status periodically
  useEffect(() => {
    const id = setInterval(() => {
      setBudgetSnapshot(budgetGuard.snapshot());
      setMcpServerCount(mcpManager.getServerStatus().filter((s) => s.connected).length);
    }, 2000);
    return () => clearInterval(id);
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
        // Ctrl+S — settings
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
        // Ctrl+T — tools
        if (key.ctrl && inputCh === 't') {
          setModal((m) => (m === 'tools' ? 'none' : 'tools'));
          return;
        }
        // Ctrl+P — profiles
        if (key.ctrl && inputCh === 'p') {
          setModal((m) => (m === 'profiles' ? 'none' : 'profiles'));
          return;
        }
        // Ctrl+M — memory
        if (key.ctrl && inputCh === 'm') {
          setModal((m) => (m === 'memory' ? 'none' : 'memory'));
          return;
        }
        // Ctrl+B — budget
        if (key.ctrl && inputCh === 'b') {
          setModal((m) => (m === 'budget' ? 'none' : 'budget'));
          return;
        }
        // Ctrl+E — export
        if (key.ctrl && inputCh === 'e') {
          setModal((m) => (m === 'export' ? 'none' : 'export'));
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
    if (v === '/tools') {
      setModal('tools');
      return;
    }
    if (v === '/profiles') {
      setModal('profiles');
      return;
    }
    if (v === '/templates') {
      setModal('templates');
      return;
    }
    if (v === '/memory') {
      setModal('memory');
      return;
    }
    if (v === '/budget') {
      setModal('budget');
      return;
    }
    if (v === '/budget reset' || v.startsWith('/budget reset')) {
      budgetGuard.reset();
      setBudgetSnapshot(budgetGuard.snapshot());
      const msg: ChatMessage = {
        id: `budget_${Date.now()}`,
        role: 'assistant',
        content: '✓ Budget counters reset.',
        createdAt: Date.now(),
      };
      setMessages((p) => [...p, msg]);
      return;
    }
    if (v === '/mcp') {
      setModal('mcp');
      return;
    }
    if (v === '/export') {
      setModal('export');
      return;
    }
    // /template <name> [vars JSON]
    if (v.startsWith('/template ')) {
      const rest = v.slice('/template '.length).trim();
      const spaceIdx = rest.indexOf(' ');
      const name = spaceIdx > 0 ? rest.slice(0, spaceIdx) : rest;
      const varsStr = spaceIdx > 0 ? rest.slice(spaceIdx + 1) : '';
      let vars: Record<string, string> = {};
      if (varsStr) {
        try {
          vars = JSON.parse(varsStr);
        } catch {
          // ignore
        }
      }
      promptTemplates
        .render(name, vars)
        .then((rendered) => {
          void agent.send(rendered);
        })
        .catch((e) => {
          const msg: ChatMessage = {
            id: `tmpl_${Date.now()}`,
            role: 'assistant',
            content: `❌ Template error: ${e?.message || e}`,
            createdAt: Date.now(),
          };
          setMessages((p) => [...p, msg]);
        });
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

  // Compute header badges
  const totalToolCount = TOOLS.length + mcpManager.getToolDefinitions().length;
  const budgetActive = budgetGuard.isActive();
  const budgetPercent = budgetActive
    ? Math.max(
        budgetSnapshot.percentages.usd || 0,
        budgetSnapshot.percentages.tokens || 0,
        budgetSnapshot.percentages.toolCalls || 0
      )
    : undefined;

  return (
    <Box flexDirection="column">
      {showBanner ? (
        <Banner subtitle="AI coding agent · /help for commands · Ctrl+T tools · Ctrl+P profiles" />
      ) : null}

      <Header
        providerName={config.provider.name}
        model={config.provider.model || '(no model)'}
        cwd={cwd}
        sessionTitle={sessionTitle}
        toolCount={totalToolCount}
        mcpServers={mcpServerCount}
        budgetActive={budgetActive}
        budgetPercent={budgetPercent}
      />

      {!config.apiKey ? (
        <Box paddingX={1}>
          <Text color="yellow">⚠ {getProviderInfo(config)}</Text>
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
            : 'Type a message or /help for commands…'
        }
      />

      <StatusBar
        thinking={thinking}
        pendingTools={pendingTools}
        error={error || undefined}
      />

      {/* Modal panels */}
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

      {modal === 'tools' ? (
        <Box flexDirection="column" marginTop={1}>
          <ToolsPanel onClose={() => setModal('none')} />
        </Box>
      ) : null}

      {modal === 'profiles' ? (
        <Box flexDirection="column" marginTop={1}>
          <ProfilesPanel onClose={() => setModal('none')} />
        </Box>
      ) : null}

      {modal === 'templates' ? (
        <Box flexDirection="column" marginTop={1}>
          <TemplatesPanel
            onClose={() => setModal('none')}
            onUse={(cmd) => setInput(cmd)}
          />
        </Box>
      ) : null}

      {modal === 'budget' ? (
        <Box flexDirection="column" marginTop={1}>
          <BudgetPanel onClose={() => setModal('none')} />
        </Box>
      ) : null}

      {modal === 'memory' ? (
        <Box flexDirection="column" marginTop={1}>
          <MemoryPanel onClose={() => setModal('none')} />
        </Box>
      ) : null}

      {modal === 'mcp' ? (
        <Box flexDirection="column" marginTop={1}>
          <MCPPanel onClose={() => setModal('none')} />
        </Box>
      ) : null}

      {modal === 'export' ? (
        <Box flexDirection="column" marginTop={1}>
          <ExportPanel
            messages={messages}
            sessionTitle={sessionTitle}
            onClose={() => setModal('none')}
          />
        </Box>
      ) : null}
    </Box>
  );
}

const HELP_TEXT = `## Slash Commands

**Session**
- \`/help\` — show this help
- \`/new\` — start a new session
- \`/sessions\` — open the session list
- \`/clear\` — clear visible messages
- \`/quit\`, \`/exit\` — quit

**Settings**
- \`/settings\` — open settings panel

**Browse fitur baru**
- \`/tools\` — list all 33 native + MCP tools
- \`/profiles\` — show 7 agent profiles
- \`/templates\` — browse 8 prompt templates
- \`/memory\` — browse persistent memory
- \`/mcp\` — show connected MCP servers
- \`/budget\` — show budget usage
- \`/budget reset\` — reset budget counters
- \`/export\` — export conversation (md/html/json)

**Use a prompt template**
- \`/template review {"file":"src/foo.ts"}\` — render & send a template

## Keybinds

- **Enter** — send message
- **Ctrl+S** — settings
- **Ctrl+L** — sessions
- **Ctrl+N** — new session
- **Ctrl+T** — tools panel
- **Ctrl+P** — profiles panel
- **Ctrl+M** — memory panel
- **Ctrl+B** — budget panel
- **Ctrl+E** — export panel
- **Esc** — cancel in-flight call (or close panel)
- **Ctrl+C** — quit
`;
