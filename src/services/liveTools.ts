import {
  Behavior,
  type FunctionCall,
  type FunctionDeclaration,
  type FunctionResponse,
} from '@google/genai'
import { z } from 'zod'
import { AskRequest } from '../api-client/generated/schemas'
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
const versionedBook = { bookId: integerId, contentVersion: z.uuid() }
const sectionTarget = {
  ...versionedBook,
  sectionId: integerId,
}
const segmentTarget = {
  ...versionedBook,
  segmentId: integerId,
  offset: z
    .number()
    .int()
    .nonnegative()
    .max(Number.MAX_SAFE_INTEGER)
    .optional(),
}
const schemas = {
  ask_library: AskRequest.extend({ book_id: integerId.positive() }).strict(),
  getAppHelp: z.strictObject({
    topic: z.enum(['overview', 'reader', 'live', 'turner']),
  }),
  getAppLocation: noArguments,
  getReaderSettings: noArguments,
  getReadingPosition: noArguments,
  getBookDownloadState: z.strictObject({
    bookId: integerId,
  }),
  getNarrationState: noArguments,
  listAvailableBooks: z.strictObject({
    offset: z
      .number()
      .int()
      .nonnegative()
      .max(Number.MAX_SAFE_INTEGER)
      .optional(),
  }),
  getBookInfo: z.strictObject({ bookId: integerId }),
  getBookToc: z.strictObject(versionedBook),
  getSegments: z.strictObject({
    ...versionedBook,
    segmentIds: z.array(integerId).min(1),
  }),
  getTextPage: z.strictObject({
    offset: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
  }),
  endLiveSession: noArguments,
  goHome: noArguments,
  downloadBook: z.strictObject({ bookId: integerId }),
  refreshLibrary: noArguments,
  setTextSize: z.strictObject({
    percent: z
      .number()
      .min(TEXT_SIZE_BASE)
      .max(TEXT_SIZE_BASE + MAX_TEXT_SIZE_STEP * TEXT_SIZE_INCREMENT)
      .refine((value) =>
        Number.isInteger((value - TEXT_SIZE_BASE) / TEXT_SIZE_INCREMENT),
      ),
  }),
  setPlaybackSpeed: z.strictObject({
    rate: z.number().min(0.75).max(2).refine(isPlaybackSpeed),
  }),
  adjustPlaybackSpeed: z.strictObject({
    direction: z.enum(['slower', 'faster']),
  }),
  toggleReaderControls: noArguments,
  setViewMode: z.strictObject({ mode: z.enum(['text', 'pdf']) }),
  selectSegment: z.strictObject({
    ...versionedBook,
    segmentId: integerId.nullable(),
  }),
  openBook: z.strictObject({
    bookId: integerId,
    contentVersion: z.uuid().optional(),
  }),
  navigateToSection: z.strictObject(sectionTarget),
  navigateToSegment: z.strictObject(segmentTarget),
  startPlayback: z.strictObject({
    destination: z.discriminatedUnion('target', [
      z.strictObject({ ...versionedBook, target: z.literal('current') }),
      z.strictObject({ ...sectionTarget, target: z.literal('section') }),
      z.strictObject({ ...segmentTarget, target: z.literal('segment') }),
    ]),
  }),
  moveTextPage: z.strictObject({ direction: z.enum(['previous', 'next']) }),
}
const descriptions = [
  'Answer a self-contained question from a complete book. Returns answer, limitations and versioned references. No local download needed. Effort defaults to low.',
  'Get manual help for overview, reader, live or turner.',
  'Get current route and reader availability.',
  'Get text size, narration speed, Text/PDF mode and control visibility.',
  'Get canonical anchor and separate selections.',
  'Get book download progress and completeness.',
  'Get requested/observed narration state, cue and error.',
  'List saved book identities; follow nextOffset. A partial catalog cannot establish absence. Use getBookInfo for details.',
  'Get saved book metadata and cached content identity; never downloads.',
  'Get cached ordered sections: id, parent_id and title. Reports ready/partial/stale/unavailable; never downloads or opens.',
  'Get exact cached segments: id, section_id, plain text and narration times. Reports missingIds/completeness; never downloads.',
  'Read current (0), previous (-1) or next (1) Text page without moving. Reports edge/preparing/stale/unavailable.',
  'End Live immediately, preserving continuation. No farewell required.',
  'Go to the library using app navigation.',
  'Background text download only; use openBook to read. No follow-up turn on completion: do not promise later actions/notification.',
  'Refresh the shared library catalog.',
  'Set text size: 100–500%, step 12.5; preserves position.',
  'Set narration speed: 0.75–2, step 0.05, default 1. Preserves pitch; does not play.',
  'Change narration speed by 0.05, bounded to 0.75–2.',
  'Toggle reader controls. For show/hide requests, first read getReaderSettings.',
  'Set Text/PDF mode; PDF requires a source file.',
  'Select/clear a segment in the active book/version; does not move or play.',
  'Open known bookId; automatically downloads missing text and restores position. Do not download separately. Optional contentVersion requires a cached match.',
  'Open a cached section, including nested sections, using ToC IDs.',
  'Open a cached segment at an optional code-point/grapheme boundary offset.',
  'Read aloud: selected passage uses getReadingPosition.selectedSegmentId and scope with target="segment"; target="section" is a whole section; target="current" is the Text position. Requires cached audio/timing. Acceptance is not playback; success closes Live.',
  'Move one Text page; waits for layout. Edges do not move.',
]
export const liveToolDeclarations: FunctionDeclaration[] = Object.entries(
  schemas,
).map(([name, schema], index) => {
  const parameters = z.toJSONSchema(schema)
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
          const schema = Object.hasOwn(schemas, name)
            ? schemas[name as keyof typeof schemas]
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
                            () => failure,
                          )
                          .finally(() => requests.delete(id))
                      : { result: value }
                } catch {
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
