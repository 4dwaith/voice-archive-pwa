import {
  Behavior,
  type FunctionCall,
  type FunctionDeclaration,
  type FunctionResponse,
} from '@google/genai'
import { z } from 'zod'
import {
  TEXT_SIZE_BASE,
  TEXT_SIZE_INCREMENT,
  MAX_TEXT_SIZE_STEP,
} from '../store/textSizeSlice'
import { isPlaybackSpeed } from '../store/playbackSpeedSlice'
import type { ReaderCommand } from '../store/readerCommandsSlice'
import { type createLiveQueries } from './liveQueries'

const noArguments = z.strictObject({})
const integerId = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
const sectionTarget = {
  bookId: integerId,
  sectionId: integerId,
}
const segmentTarget = {
  bookId: integerId,
  segmentId: integerId,
  offset: integerId.optional(),
}

export const liveToolSchemas = {
  ask_library: z.strictObject({
    bookId: integerId.positive(),
    query: z.string().trim().min(1),
    effort: z.enum(['low', 'medium', 'high']).optional(),
  }),
  getAppHelp: z.strictObject({
    topic: z.enum(['overview', 'reader', 'live', 'turner']),
  }),
  getAppState: noArguments,
  listAvailableBooks: z.strictObject({
    offset: integerId.optional(),
  }),
  getBookInfo: z.strictObject({ bookId: integerId }),
  getBookToc: z.strictObject({ bookId: integerId }),
  getSegments: z.strictObject({
    bookId: integerId,
    segmentIds: z.array(integerId).min(1),
  }),
  getTextPage: z.strictObject({
    offset: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
  }),
  endLiveSession: noArguments,
  goHome: noArguments,
  refreshLibrary: noArguments,
  updateReaderSettings: z
    .strictObject({
      textSize: z
        .number()
        .min(TEXT_SIZE_BASE)
        .max(TEXT_SIZE_BASE + MAX_TEXT_SIZE_STEP * TEXT_SIZE_INCREMENT)
        .refine((value) =>
          Number.isInteger((value - TEXT_SIZE_BASE) / TEXT_SIZE_INCREMENT),
        )
        .optional(),
      playbackSpeed: z
        .number()
        .min(0.75)
        .max(2)
        .refine(isPlaybackSpeed)
        .optional(),
      controlsVisible: z.boolean().optional(),
      viewMode: z.enum(['text', 'pdf']).optional(),
    })
    .refine(
      (data) => Object.values(data).some((val) => val !== undefined),
      'At least one setting must be provided',
    ),
  selectSegment: z.strictObject({
    bookId: integerId,
    segmentId: integerId.nullable(),
  }),
  openBook: z.strictObject({
    bookId: integerId,
  }),
  navigateToSection: z.strictObject(sectionTarget),
  navigateToSegment: z.strictObject(segmentTarget),
  startPlayback: z.strictObject({
    destination: z.discriminatedUnion('target', [
      z.strictObject({ bookId: integerId, target: z.literal('current') }),
      z.strictObject({ ...sectionTarget, target: z.literal('section') }),
      z.strictObject({ ...segmentTarget, target: z.literal('segment') }),
    ]),
  }),
  moveTextPage: z.strictObject({ direction: z.enum(['previous', 'next']) }),
}

const descriptions = [
  'Answer a self-contained question from a complete book. Returns answer, limitations and references. No local download needed. Effort defaults to low.',
  'Get manual help for overview, reader, live or turner.',
  'Get current app location, reader settings, reading position and narration state.',
  'List saved book identities; follow nextOffset. A partial catalog cannot establish absence. Use getBookInfo for details.',
  'Get saved book metadata, cached content identity and download progress; never downloads.',
  'Get cached ordered sections: id, parent_id and title. Reports ready/partial/unavailable; never downloads or opens.',
  'Get exact cached segments: id, section_id, plain text and narration times. Reports missingIds/completeness; never downloads.',
  'Read current (0), previous (-1) or next (1) Text page without moving. Reports edge/preparing/stale/unavailable.',
  'End Live immediately, preserving continuation. No farewell required.',
  'Go to the library using app navigation.',
  'Refresh the shared library catalog.',
  'Update reader settings: textSize (100–500%, step 12.5), playbackSpeed (0.75–2, step 0.05), controlsVisible (boolean), or viewMode (text/pdf).',
  'Select or clear a segment in the active book; does not move or play.',
  'Open known bookId; automatically downloads missing text and restores position.',
  'Open a cached section, including nested sections, using ToC IDs.',
  'Open a cached segment at an optional code-point offset.',
  'Read aloud: target="segment" plays a segment; target="section" plays a whole section; target="current" plays from the Text position. Requires cached audio/timing. Acceptance is not playback; success closes Live.',
  'Move one Text page; waits for layout. Edges do not move.',
]

export function cleanParametersSchema(schema: unknown): unknown {
  if (!schema || typeof schema !== 'object') return schema
  if (Array.isArray(schema)) return schema.map(cleanParametersSchema)
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(
    schema as Record<string, unknown>,
  )) {
    if (key === 'pattern') continue
    if (key === 'additionalProperties') continue
    if (key === 'maximum' && value === Number.MAX_SAFE_INTEGER) continue
    result[key] = cleanParametersSchema(value)
  }
  return result
}

export const liveToolDeclarations: FunctionDeclaration[] = Object.entries(
  liveToolSchemas,
).map(([name, schema], index) => {
  const parameters = cleanParametersSchema(z.toJSONSchema(schema)) as Record<
    string,
    unknown
  >
  delete parameters.$schema
  return {
    name,
    description: descriptions[index],
    behavior: Behavior.BLOCKING,
    parametersJsonSchema: parameters,
  }
})

export type LiveEffectReceipts = Record<string, string>
type ToolResponse = Record<string, unknown>
type ToolResult = ToolResponse | Promise<ToolResponse>

export function createLiveTools(
  queries: ReturnType<typeof createLiveQueries>,
  endLiveSession: () => unknown,
  requestCommand: (
    command: ReaderCommand,
    requestId: string,
  ) => unknown = () => {},
  cancelCommands: () => void = () => {},
) {
  let commandId: string | undefined
  const calls = new Map<string, { signature: string; result: ToolResult }>()
  return {
    clear() {
      calls.clear()
      commandId = undefined
    },
    connect(
      signal: AbortSignal,
      receipts: LiveEffectReceipts,
      saveReceipts: () => void,
      send: (response: FunctionResponse) => void,
    ) {
      const cancelled = new Set<string>()
      const requests = new Map<string, AbortController>()
      signal.addEventListener(
        'abort',
        () => {
          requests.forEach((request) => request.abort())
        },
        { once: true },
      )
      return {
        cancel(ids: string[]) {
          ids.forEach((id) => {
            cancelled.add(id)
            requests.get(id)?.abort()
          })
          if (commandId && ids.includes(commandId)) cancelCommands()
        },
        async invoke(call: FunctionCall) {
          const { id, name } = call
          if (
            typeof id !== 'string' ||
            !id ||
            typeof name !== 'string' ||
            !name
          )
            return
          if (signal.aborted || cancelled.has(id)) return
          let response: Record<string, unknown>
          const schema = Object.hasOwn(liveToolSchemas, name)
            ? liveToolSchemas[name as keyof typeof liveToolSchemas]
            : null
          const parsed = schema?.safeParse(
            call.args === undefined ? {} : call.args,
          )
          if (!parsed?.success)
            response = { error: 'Unknown tool or invalid arguments' }
          else {
            const signature = JSON.stringify([name, parsed.data])
            const prior = calls.get(id)
            const receipt = Object.hasOwn(receipts, id)
              ? receipts[id]
              : undefined
            if (
              (prior && prior.signature !== signature) ||
              (receipt && receipt !== signature)
            )
              response = { error: 'Conflicting tool call ID' }
            else if (receipt) response = { accepted: true, requestId: id }
            else if (prior)
              response =
                prior.result instanceof Promise
                  ? await prior.result
                  : prior.result
            else {
              if (name === 'endLiveSession' || !Object.hasOwn(queries, name)) {
                const accepted = { accepted: true, requestId: id }
                Object.defineProperty(receipts, id, {
                  value: signature,
                  enumerable: true,
                })
                saveReceipts()
                if (name === 'endLiveSession') endLiveSession()
                else {
                  commandId = id
                  requestCommand(
                    { kind: name, ...parsed.data } as ReaderCommand,
                    id,
                  )
                }
                response = accepted
              } else {
                const failure = {
                  error:
                    'Information unavailable; use the manual controls or retry.',
                }
                let result: ToolResult
                const request = new AbortController()
                requests.set(id, request)
                try {
                  const query = queries[name as keyof typeof queries] as (
                    args: unknown,
                    signal: AbortSignal,
                  ) => unknown
                  const value = query(parsed.data, request.signal)
                  result =
                    value instanceof Promise
                      ? value
                          .then(
                            (result) => ({ result }),
                            (error) => {
                              if (!request.signal.aborted)
                                console.warn('Live tool query failed.', error)
                              return failure
                            },
                          )
                          .finally(() => requests.delete(id))
                      : { result: value }
                } catch (error) {
                  if (!request.signal.aborted)
                    console.warn('Live tool query failed.', error)
                  result = failure
                }
                if (!(result instanceof Promise)) requests.delete(id)
                calls.set(id, { signature, result })
                response = result instanceof Promise ? await result : result
              }
            }
          }
          if (!signal.aborted && !cancelled.has(id))
            send({ id, name, response })
        },
      }
    },
  }
}
