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
  'Answer a self-contained question from one complete book through the backend. Use a known book_id; no download or open reader is required. Optional effort is low (default), medium or high. Returns grounded answer, limitations and versioned segment references; it does not navigate or start narration.',
  'Get manual help for overview, reader, live or turner.',
  'Get current route and reader availability.',
  'Get current text size, narration speed, Text/PDF setting and reader control visibility.',
  'Get canonical anchor and separate selections.',
  'Get text download progress and committed completeness for a book.',
  'Get requested and reported narration state, cue and error.',
  'List saved book metadata in pages; follow nextOffset. A partial saved catalog does not establish that other books do not exist.',
  'Read saved book metadata and cached content identity. Missing downloaded content is unavailable; this query never downloads.',
  'Read cached ordered flat sections with parent IDs and first-segment source keys. Reports partial, stale or unavailable local content; never downloads or opens a book.',
  'Read exact cached segment IDs only. Partial results report missingIds and cache completeness without downloading text.',
  'Read exact current (0), previous (-1) or next (1) reflowed Text page in a currently open book. This never moves the reader. Edge, preparing, stale and unavailable are distinct.',
  'End Live immediately, preserving continuation. No farewell required.',
  'Go to the library using app navigation.',
  'Download book text in the background without opening it. Use openBook instead when the user wants to read it. Completion does not trigger another assistant turn; do not promise notification or a later action. Ask the user to ask again if further queries are needed after downloading.',
  'Refresh the shared library catalog.',
  'Set text size from 100 to 500 percent in steps of 12.5, preserving the reading anchor.',
  'Set the saved narration speed from 0.75 to 2 in steps of 0.05. Defaults to 1; preserves pitch and does not start playback.',
  'Increase (faster) or decrease (slower) saved narration speed by 0.05, bounded to 0.75 through 2.',
  'Toggle visibility of the open reader header and reading controls. Read getReaderSettings first when the user asks to show or hide them.',
  'Set the open book view to text or pdf; PDF requires an available source file.',
  'Select or clear an exact segment in the active book/version without navigation or playback.',
  'Open a known book directly by bookId, even without downloaded text or a known contentVersion. The normal reader shows loading and automatically displays text as it downloads; do not download separately first. Preserves normal reading-position restoration. Optional contentVersion requires a matching cached version.',
  'Open a resolved cached section, including nested sections, using IDs from ToC evidence.',
  'Open an exact cached segment at an optional canonical code-point/grapheme boundary offset.',
  'Read aloud a resolved destination. For a selected passage, first read getReadingPosition and use its selectedSegmentId and scope with target="segment". Use target="section" only for a requested whole section, or target="current" for the current Text position. Requires cached root audio/timing. Acceptance is not playback; success closes Live quietly.',
  'Move one previous or next reflowed Text page. Requires Text view; waits for committed layout. True edges do not move.',
]
export const liveToolDeclarations: FunctionDeclaration[] = Object.entries(
  schemas,
).map(([name, schema], index) => ({
  name,
  description: descriptions[index],
  behavior: Behavior.BLOCKING,
  parametersJsonSchema: z.toJSONSchema(schema),
}))

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
