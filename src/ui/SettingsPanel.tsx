import React, { useState, useEffect, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import type { AppConfig, ProviderConfig, ProviderType } from '../config.js';
import type { ProviderRecord } from '../types.js';
import {
  deleteProvider,
  listProviders,
  setActiveProvider,
  upsertProvider,
} from '../store.js';
import { fetchModels } from '../providers.js';
import { gradient } from './theme.js';

type View =
  | { kind: 'main' }
  | { kind: 'providers' }
  | { kind: 'provider_form'; record: ProviderRecord | null }
  | { kind: 'models'; record: ProviderRecord }
  | { kind: 'temperature' }
  | { kind: 'max_tokens' };

export interface SettingsPanelProps {
  initial: AppConfig;
  onSaved: (cfg: AppConfig) => void;
  onClose: () => void;
}

export function SettingsPanel({
  initial,
  onSaved,
  onClose,
}: SettingsPanelProps): JSX.Element {
  const [config, setConfig] = useState<AppConfig>(initial);
  const [view, setView] = useState<View>({ kind: 'main' });

  const refreshConfig = (next: AppConfig) => {
    setConfig(next);
    onSaved(next);
  };

  const goBack = () => {
    if (view.kind === 'main') {
      onClose();
    } else if (view.kind === 'models' || view.kind === 'provider_form') {
      setView({ kind: 'providers' });
    } else {
      setView({ kind: 'main' });
    }
  };

  return (
    <Box flexDirection="column">
      {view.kind === 'main' ? (
        <MainMenu
          config={config}
          onSelect={(target) => {
            switch (target) {
              case 'providers':
                setView({ kind: 'providers' });
                break;
              case 'models': {
                const providers = listProviders();
                const active =
                  providers.find((p) => p.id === config.providerId) ||
                  providers[0] ||
                  null;
                if (active) {
                  setView({ kind: 'models', record: active });
                } else {
                  setView({ kind: 'providers' });
                }
                break;
              }
              case 'temperature':
                setView({ kind: 'temperature' });
                break;
              case 'max_tokens':
                setView({ kind: 'max_tokens' });
                break;
            }
          }}
          onClose={onClose}
        />
      ) : null}

      {view.kind === 'providers' ? (
        <ProvidersList
          activeId={config.providerId}
          onUse={(rec) => {
            setActiveProvider(rec.id);
            refreshConfig({
              ...config,
              providerId: rec.id,
              provider: {
                id: rec.id,
                name: rec.name,
                type: rec.type as ProviderType,
                apiKey: rec.apiKey,
                baseURL: rec.baseURL,
                model: rec.model,
              },
              apiKey: rec.apiKey,
              model: rec.model,
            });
          }}
          onEdit={(rec) =>
            setView({ kind: 'provider_form', record: rec })
          }
          onAdd={() =>
            setView({ kind: 'provider_form', record: null })
          }
          onModels={(rec) => setView({ kind: 'models', record: rec })}
          onDelete={(rec) => {
            deleteProvider(rec.id);
            // Reload config to pick up new active (if it was deleted).
            const providers = listProviders();
            const newActive = providers[0] || null;
            const provider: ProviderConfig = newActive
              ? {
                  id: newActive.id,
                  name: newActive.name,
                  type: newActive.type as ProviderType,
                  apiKey: newActive.apiKey,
                  baseURL: newActive.baseURL,
                  model: newActive.model,
                }
              : {
                  type: 'openai',
                  name: 'OpenAI',
                  apiKey: '',
                  model: '',
                };
            refreshConfig({
              ...config,
              providerId: provider.id,
              provider,
              apiKey: provider.apiKey,
              model: provider.model,
            });
          }}
          onBack={goBack}
        />
      ) : null}

      {view.kind === 'provider_form' ? (
        <ProviderForm
          record={view.record}
          onSubmit={(rec) => {
            const saved = upsertProvider({
              id: rec.id,
              name: rec.name,
              type: rec.type,
              apiKey: rec.apiKey,
              baseURL: rec.baseURL,
              model: rec.model || '',
            });
            // Make active if there was no active provider before.
            if (!config.providerId) {
              setActiveProvider(saved.id);
              refreshConfig({
                ...config,
                providerId: saved.id,
                provider: {
                  id: saved.id,
                  name: saved.name,
                  type: saved.type as ProviderType,
                  apiKey: saved.apiKey,
                  baseURL: saved.baseURL,
                  model: saved.model,
                },
                apiKey: saved.apiKey,
                model: saved.model,
              });
            } else if (config.providerId === saved.id) {
              refreshConfig({
                ...config,
                provider: {
                  id: saved.id,
                  name: saved.name,
                  type: saved.type as ProviderType,
                  apiKey: saved.apiKey,
                  baseURL: saved.baseURL,
                  model: saved.model,
                },
                apiKey: saved.apiKey,
                model: saved.model,
              });
            }
            setView({ kind: 'providers' });
          }}
          onBack={goBack}
        />
      ) : null}

      {view.kind === 'models' ? (
        <ModelsView
          record={view.record}
          onSelect={(model) => {
            const saved = upsertProvider({
              id: view.record.id,
              name: view.record.name,
              type: view.record.type,
              apiKey: view.record.apiKey,
              baseURL: view.record.baseURL,
              model,
            });
            setActiveProvider(saved.id);
            refreshConfig({
              ...config,
              providerId: saved.id,
              provider: {
                id: saved.id,
                name: saved.name,
                type: saved.type as ProviderType,
                apiKey: saved.apiKey,
                baseURL: saved.baseURL,
                model: saved.model,
              },
              apiKey: saved.apiKey,
              model: saved.model,
            });
            setView({ kind: 'providers' });
          }}
          onBack={goBack}
        />
      ) : null}

      {view.kind === 'temperature' ? (
        <NumberEdit
          label="Temperature"
          initial={String(config.temperature)}
          hint="Range 0.0 – 2.0. Lower is more deterministic."
          onSubmit={(v) => {
            const n = clamp(parseFloat(v), 0, 2);
            refreshConfig({ ...config, temperature: n });
            setView({ kind: 'main' });
          }}
          onBack={goBack}
        />
      ) : null}

      {view.kind === 'max_tokens' ? (
        <NumberEdit
          label="Max Tokens"
          initial={String(config.maxTokens)}
          hint="Maximum tokens per response."
          onSubmit={(v) => {
            const n = Math.max(1, Math.floor(Number(v) || 0));
            refreshConfig({ ...config, maxTokens: n });
            setView({ kind: 'main' });
          }}
          onBack={goBack}
        />
      ) : null}
    </Box>
  );
}

// ──────────── Main menu ────────────

type MainTarget = 'providers' | 'models' | 'temperature' | 'max_tokens';

function MainMenu({
  config,
  onSelect,
  onClose,
}: {
  config: AppConfig;
  onSelect: (t: MainTarget) => void;
  onClose: () => void;
}): JSX.Element {
  const items: { key: MainTarget; label: string; value: string }[] = [
    {
      key: 'providers',
      label: 'List Providers',
      value: config.provider.name || '(none)',
    },
    {
      key: 'models',
      label: 'Models',
      value: config.provider.model || '(no model)',
    },
    {
      key: 'temperature',
      label: 'Temperature',
      value: String(config.temperature),
    },
    {
      key: 'max_tokens',
      label: 'Max Tokens',
      value: String(config.maxTokens),
    },
  ];
  const [idx, setIdx] = useState(0);
  const colors = gradient(2);

  useInput((_, key) => {
    if (key.escape) {
      onClose();
      return;
    }
    if (key.upArrow) setIdx((i) => Math.max(0, i - 1));
    if (key.downArrow) setIdx((i) => Math.min(items.length - 1, i + 1));
    if (key.return) onSelect(items[idx].key);
  });

  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor={colors[0]}
      paddingX={2}
      paddingY={1}
    >
      <Box marginBottom={1}>
        <Text color={colors[0]} bold>
          ⚙ Settings
        </Text>
        <Text color="gray"> · ↑↓ navigate · Enter open · Esc close</Text>
      </Box>

      <ProviderInfoCard config={config} />

      <Box marginTop={1} flexDirection="column">
        {items.map((it, i) => {
          const active = i === idx;
          return (
            <Box key={it.key}>
              <Box width={20}>
                <Text color={active ? 'cyanBright' : 'gray'} bold={active}>
                  {active ? '› ' : '  '}
                  {it.label}
                </Text>
              </Box>
              <Box flexGrow={1}>
                <Text color={active ? 'white' : 'gray'}>{it.value}</Text>
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

function ProviderInfoCard({ config }: { config: AppConfig }): JSX.Element {
  const colors = gradient(2);
  const p = config.provider;
  return (
    <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1}>
      <Box>
        <Text color={colors[0]} bold>
          Active Provider
        </Text>
      </Box>
      <Row label="Name" value={p.name || '(none)'} />
      <Row label="Type" value={p.type} />
      <Row label="Model" value={p.model || '(none)'} />
      {p.type === 'custom' ? (
        <Row label="Base URL" value={p.baseURL || '(none)'} />
      ) : null}
      <Row label="API Key" value={maskKey(p.apiKey)} />
    </Box>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Box width={12}>
        <Text color="gray">{label}</Text>
      </Box>
      <Box flexGrow={1}>
        <Text>{value}</Text>
      </Box>
    </Box>
  );
}

// ──────────── Providers list ────────────

function ProvidersList({
  activeId,
  onUse,
  onEdit,
  onAdd,
  onModels,
  onDelete,
  onBack,
}: {
  activeId?: string;
  onUse: (p: ProviderRecord) => void;
  onEdit: (p: ProviderRecord) => void;
  onAdd: () => void;
  onModels: (p: ProviderRecord) => void;
  onDelete: (p: ProviderRecord) => void;
  onBack: () => void;
}): JSX.Element {
  const [providers, setProviders] = useState<ProviderRecord[]>(() =>
    listProviders()
  );
  const [idx, setIdx] = useState(0);
  const total = providers.length + 1; // +1 for "Add" item
  const colors = gradient(2);

  // Reload after mutations
  useEffect(() => {
    setProviders(listProviders());
  }, []);

  const selectedRec = idx < providers.length ? providers[idx] : null;
  const onAddRow = idx === providers.length;

  useInput((input: string, key: any) => {
    if (key.escape) {
      onBack();
      return;
    }
    if (key.upArrow) setIdx((i) => Math.max(0, i - 1));
    if (key.downArrow) setIdx((i) => Math.min(total - 1, i + 1));
    if (key.return) {
      if (onAddRow) {
        onAdd();
      } else if (selectedRec) {
        onUse(selectedRec);
      }
      return;
    }
    if (input === 'e' && selectedRec) onEdit(selectedRec);
    if (input === 'm' && selectedRec) onModels(selectedRec);
    if (input === 'a') onAdd();
    if ((input === 'd' || (key.delete as boolean)) && selectedRec) {
      onDelete(selectedRec);
      setProviders(listProviders());
      setIdx((i) => Math.max(0, i - 1));
    }
  });

  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor={colors[0]}
      paddingX={2}
      paddingY={1}
    >
      <Box marginBottom={1}>
        <Text color={colors[0]} bold>
          ◆ Providers
        </Text>
        <Text color="gray">
          {' '}· Enter use · e edit · m models · a add · d delete · Esc back
        </Text>
      </Box>

      {providers.length === 0 ? (
        <Box marginBottom={1}>
          <Text color="gray">No providers yet.</Text>
        </Box>
      ) : (
        providers.map((p, i) => {
          const active = i === idx;
          const current = p.id === activeId;
          return (
            <Box key={p.id}>
              <Text
                color={active ? 'cyanBright' : current ? 'magenta' : 'gray'}
              >
                {active ? '› ' : '  '}
              </Text>
              <Box width={28}>
                <Text
                  color={active ? 'cyanBright' : 'white'}
                  bold={active}
                >
                  {p.name}
                </Text>
              </Box>
              <Box width={10}>
                <Text color="gray">{p.type}</Text>
              </Box>
              <Box flexGrow={1}>
                <Text color="gray">
                  {p.model || '(no model)'}
                  {current ? '  · active' : ''}
                </Text>
              </Box>
            </Box>
          );
        })
      )}

      {/* Add row */}
      <Box>
        <Text color={onAddRow ? 'cyanBright' : 'gray'}>
          {onAddRow ? '› ' : '  '}
        </Text>
        <Text color={onAddRow ? 'cyanBright' : 'green'} bold>
          + Add OpenAI-compatible provider
        </Text>
      </Box>
    </Box>
  );
}

// ──────────── Provider form (add/edit) ────────────

type Field = 'name' | 'type' | 'baseURL' | 'apiKey';

function ProviderForm({
  record,
  onSubmit,
  onBack,
}: {
  record: ProviderRecord | null;
  onSubmit: (rec: {
    id?: string;
    name: string;
    type: ProviderType;
    apiKey: string;
    baseURL?: string;
    model: string;
  }) => void;
  onBack: () => void;
}): JSX.Element {
  const [name, setName] = useState(record?.name || 'Custom Provider');
  const [type, setType] = useState<ProviderType>(
    (record?.type as ProviderType) || 'custom'
  );
  const [apiKey, setApiKey] = useState(record?.apiKey || '');
  const [baseURL, setBaseURL] = useState(record?.baseURL || '');
  const [model, setModel] = useState(record?.model || '');

  const fields: Field[] = useMemo(() => {
    const arr: Field[] = ['name', 'type'];
    if (type === 'custom') arr.push('baseURL');
    arr.push('apiKey');
    return arr;
  }, [type]);

  const [active, setActive] = useState(0);
  const [editing, setEditing] = useState(false);
  const colors = gradient(2);

  useInput((input: string, key: any) => {
    if (editing) return; // editing handled by TextInput
    if (key.escape) {
      onBack();
      return;
    }
    if (key.upArrow) setActive((i) => Math.max(0, i - 1));
    if (key.downArrow || key.tab)
      setActive((i) => Math.min(fields.length - 1, i + 1));
    if (key.return) setEditing(true);
    if (fields[active] === 'type' && (key.leftArrow || key.rightArrow || input === ' ')) {
      setType((t) => (t === 'openai' ? 'custom' : 'openai'));
    }
    if (key.ctrl && input === 's') {
      doSubmit();
    }
  });

  function doSubmit() {
    if (!name.trim()) return;
    onSubmit({
      id: record?.id,
      name: name.trim(),
      type,
      apiKey,
      baseURL: type === 'custom' ? baseURL.trim() : undefined,
      model: model || record?.model || '',
    });
  }

  const f = fields[active];

  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor={colors[0]}
      paddingX={2}
      paddingY={1}
    >
      <Box marginBottom={1}>
        <Text color={colors[0]} bold>
          {record ? '✎ Edit Provider' : '+ Add Provider'}
        </Text>
        <Text color="gray">
          {' '}· ↑↓ navigate · Enter edit · ←→ toggle · Ctrl+S save · Esc back
        </Text>
      </Box>

      <FormRow label="Name" active={f === 'name'}>
        {editing && f === 'name' ? (
          <TextInput
            value={name}
            onChange={setName}
            onSubmit={() => setEditing(false)}
          />
        ) : (
          <Text color={name ? 'white' : 'gray'}>{name || '(empty)'}</Text>
        )}
      </FormRow>

      <FormRow label="Type" active={f === 'type'}>
        <Toggle
          options={['openai', 'custom']}
          value={type}
          highlighted={f === 'type'}
        />
      </FormRow>

      {type === 'custom' ? (
        <FormRow label="Base URL" active={f === 'baseURL'}>
          {editing && f === 'baseURL' ? (
            <TextInput
              value={baseURL}
              onChange={setBaseURL}
              onSubmit={() => setEditing(false)}
              placeholder="http://localhost:1234/v1"
            />
          ) : (
            <Text color={baseURL ? 'white' : 'gray'}>
              {baseURL || 'http://localhost:1234/v1'}
            </Text>
          )}
        </FormRow>
      ) : null}

      <FormRow label="API Key" active={f === 'apiKey'}>
        {editing && f === 'apiKey' ? (
          <TextInput
            value={apiKey}
            onChange={setApiKey}
            onSubmit={() => setEditing(false)}
            mask="•"
            placeholder="sk-…"
          />
        ) : (
          <Text color={apiKey ? 'white' : 'gray'}>{maskKey(apiKey)}</Text>
        )}
      </FormRow>

      <Box marginTop={1}>
        <Text color="gray">
          Press <Text color="yellow">Ctrl+S</Text> to save · After saving, pick
          a model from the Models menu.
        </Text>
      </Box>
    </Box>
  );
}

// ──────────── Models view ────────────

function ModelsView({
  record,
  onSelect,
  onBack,
}: {
  record: ProviderRecord;
  onSelect: (model: string) => void;
  onBack: () => void;
}): JSX.Element {
  const [models, setModels] = useState<string[]>(
    record.model ? [record.model] : []
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idx, setIdx] = useState(() =>
    Math.max(0, models.findIndex((m) => m === record.model))
  );
  const [filter, setFilter] = useState('');
  const [filtering, setFiltering] = useState(false);
  const colors = gradient(2);

  const visible = useMemo(() => {
    if (!filter) return models;
    const q = filter.toLowerCase();
    return models.filter((m) => m.toLowerCase().includes(q));
  }, [models, filter]);

  useEffect(() => {
    void doFetch();
  }, []);

  async function doFetch() {
    if (!record.apiKey) {
      setError('API key not set on this provider.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await fetchModels({
        type: record.type as ProviderType,
        apiKey: record.apiKey,
        baseURL: record.baseURL,
      });
      setModels(list);
      const newIdx = list.findIndex((m) => m === record.model);
      setIdx(newIdx >= 0 ? newIdx : 0);
    } catch (e: any) {
      setError(e?.message || 'Failed to fetch models');
    } finally {
      setLoading(false);
    }
  }

  useInput((input: string, key: any) => {
    if (filtering) return;
    if (key.escape) {
      onBack();
      return;
    }
    if (key.upArrow) setIdx((i) => Math.max(0, i - 1));
    if (key.downArrow)
      setIdx((i) => Math.min(Math.max(0, visible.length - 1), i + 1));
    if (key.return) {
      const m = visible[idx];
      if (m) onSelect(m);
    }
    if (input === 'r' || input === 'R') void doFetch();
    if (input === '/') setFiltering(true);
  });

  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor={colors[0]}
      paddingX={2}
      paddingY={1}
    >
      <Box marginBottom={1}>
        <Text color={colors[0]} bold>
          ⊕ Models
        </Text>
        <Text color="gray">
          {' '}· {record.name} · ↑↓ select · Enter use · / filter · r refetch ·
          Esc back
        </Text>
      </Box>

      {filtering ? (
        <Box marginBottom={1}>
          <Text color="cyan">filter › </Text>
          <Box flexGrow={1}>
            <TextInput
              value={filter}
              onChange={setFilter}
              onSubmit={() => setFiltering(false)}
            />
          </Box>
        </Box>
      ) : filter ? (
        <Box marginBottom={1}>
          <Text color="gray">filter: </Text>
          <Text color="cyan">{filter}</Text>
        </Box>
      ) : null}

      {loading ? (
        <Text color="cyan">
          <Spinner type="dots" /> fetching models…
        </Text>
      ) : null}

      {error ? <Text color="red">⚠ {error}</Text> : null}

      <Box flexDirection="column" marginTop={1}>
        {visible.length === 0 && !loading ? (
          <Text color="gray">No models. Press r to refetch.</Text>
        ) : null}
        {visible.slice(0, 20).map((m, i) => {
          const active = i === idx;
          const current = m === record.model;
          return (
            <Box key={m}>
              <Text
                color={active ? 'cyanBright' : current ? 'magenta' : 'gray'}
              >
                {active ? '› ' : '  '}
              </Text>
              <Box flexGrow={1}>
                <Text
                  color={active ? 'cyanBright' : current ? 'white' : 'white'}
                  bold={active}
                >
                  {m}
                </Text>
              </Box>
              {current ? <Text color="gray"> · current</Text> : null}
            </Box>
          );
        })}
        {visible.length > 20 ? (
          <Text color="gray">  … +{visible.length - 20} more (filter to narrow)</Text>
        ) : null}
      </Box>
    </Box>
  );
}

// ──────────── Number edit (temperature / max tokens) ────────────

function NumberEdit({
  label,
  initial,
  hint,
  onSubmit,
  onBack,
}: {
  label: string;
  initial: string;
  hint?: string;
  onSubmit: (v: string) => void;
  onBack: () => void;
}): JSX.Element {
  const [value, setValue] = useState(initial);
  const colors = gradient(2);

  useInput((_, key: any) => {
    if (key.escape) onBack();
  });

  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor={colors[0]}
      paddingX={2}
      paddingY={1}
    >
      <Box marginBottom={1}>
        <Text color={colors[0]} bold>
          ✎ {label}
        </Text>
        <Text color="gray"> · Enter save · Esc back</Text>
      </Box>
      <Box>
        <Text color="cyanBright">› </Text>
        <Box flexGrow={1}>
          <TextInput
            value={value}
            onChange={setValue}
            onSubmit={onSubmit}
          />
        </Box>
      </Box>
      {hint ? (
        <Box marginTop={1}>
          <Text color="gray">{hint}</Text>
        </Box>
      ) : null}
    </Box>
  );
}

// ──────────── shared bits ────────────

function FormRow({
  label,
  active,
  children,
}: {
  label: string;
  active: boolean;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <Box>
      <Box width={14}>
        <Text color={active ? 'cyanBright' : 'gray'} bold={active}>
          {active ? '› ' : '  '}
          {label}
        </Text>
      </Box>
      <Box flexGrow={1}>{children}</Box>
    </Box>
  );
}

function Toggle({
  options,
  value,
  highlighted,
}: {
  options: string[];
  value: string;
  highlighted: boolean;
}): JSX.Element {
  return (
    <Box>
      {options.map((o) => (
        <Box key={o} marginRight={1}>
          <Text
            color={
              o === value ? (highlighted ? 'cyanBright' : 'white') : 'gray'
            }
            bold={o === value}
            inverse={o === value && highlighted}
          >
            {' '}
            {o}{' '}
          </Text>
        </Box>
      ))}
    </Box>
  );
}

function maskKey(key: string): string {
  if (!key) return '(not set)';
  if (key.length < 8) return '•'.repeat(key.length);
  return '•'.repeat(8) + key.slice(-4);
}

function clamp(n: number, lo: number, hi: number): number {
  if (Number.isNaN(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}
