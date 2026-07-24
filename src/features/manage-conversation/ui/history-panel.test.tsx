// @vitest-environment happy-dom
// docs/specs/11 수용 기준 6~9 동결 테스트 — 구현 중 수정 금지

import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { envelope, server, useMswServer } from '../../../shared/test/msw'
import { renderWithProviders } from '../../../shared/test/render'
import { HistoryPanel } from './history-panel'

const conversation1 = {
  id: 'conversation-1',
  type: 'GUIDELINE_QA',
  title: '요통 진료 상담',
  status: 'ACTIVE',
  updatedAt: '2026-07-24T00:00:00.000Z',
}

const conversation2 = {
  id: 'conversation-2',
  type: 'GUIDELINE_QA',
  title: '불면 진료 상담',
  status: 'ACTIVE',
  updatedAt: '2026-07-24T00:00:00.000Z',
}

const message = {
  id: 'message-1',
  role: 'USER',
  content: '만성 요통에 침 치료가 효과적인가요?',
  status: 'COMPLETED',
  citations: [],
  createdAt: '2026-07-24T00:00:00.000Z',
}

const conversationsPage = {
  size: 20,
  hasNext: false,
  nextCursor: null,
}

const messagesPage = {
  size: 50,
  hasNext: false,
  nextCursor: null,
}

function useConversationReadHandlers() {
  server.use(
    http.get('/api/v1/conversations', () =>
      HttpResponse.json(
        envelope([conversation1, conversation2], conversationsPage),
      ),
    ),
    http.get(
      '/api/v1/conversations/conversation-1/messages',
      () =>
        HttpResponse.json(envelope([message], messagesPage)),
    ),
  )
}

async function renderAndSelectConversation() {
  const user = userEvent.setup()

  renderWithProviders(<HistoryPanel />)

  const conversationButton = await screen.findByRole('button', {
    name: '요통 진료 상담',
  })
  expect(
    await screen.findByRole('button', { name: '불면 진료 상담' }),
  ).toBeInTheDocument()

  await user.click(conversationButton)

  expect(
    await screen.findByText('만성 요통에 침 치료가 효과적인가요?'),
  ).toBeInTheDocument()

  return user
}

describe('HistoryPanel docs/specs/11 수용 기준 6~9', () => {
  useMswServer()

  it('기준 6: 대화 목록을 렌더하고 선택한 대화의 메시지를 표시한다', async () => {
    useConversationReadHandlers()

    await renderAndSelectConversation()
  })

  it('기준 7: 선택한 대화의 이름을 변경한다', async () => {
    let patchBody: unknown

    useConversationReadHandlers()
    server.use(
      http.patch(
        '/api/v1/conversations/conversation-1',
        async ({ request }) => {
          patchBody = await request.json()

          return HttpResponse.json(
            envelope({
              ...conversation1,
              title: '수정된 상담 제목',
            }),
          )
        },
      ),
    )

    const user = await renderAndSelectConversation()

    await user.click(screen.getByRole('button', { name: '이름 변경' }))

    const titleInput = screen.getByRole('textbox', { name: '대화 제목' })
    await user.clear(titleInput)
    await user.type(titleInput, '수정된 상담 제목')
    await user.click(screen.getByRole('button', { name: '저장' }))

    await waitFor(() => {
      expect(patchBody).toEqual({ title: '수정된 상담 제목' })
    })
    expect(await screen.findByText('수정된 상담 제목')).toBeInTheDocument()
  })

  it('기준 8: 선택한 대화를 보관한다', async () => {
    let archiveCalled = false

    useConversationReadHandlers()
    server.use(
      http.post(
        '/api/v1/conversations/conversation-1/archive',
        () => {
          archiveCalled = true

          return HttpResponse.json(envelope(null))
        },
      ),
    )

    const user = await renderAndSelectConversation()

    await user.click(screen.getByRole('button', { name: '보관' }))

    await waitFor(() => {
      expect(archiveCalled).toBe(true)
    })
  })

  it('기준 9: 검색어를 query 파라미터로 보내 대화 목록을 재조회한다', async () => {
    const requestedQueries: Array<string | null> = []

    server.use(
      http.get('/api/v1/conversations', ({ request }) => {
        requestedQueries.push(
          new URL(request.url).searchParams.get('query'),
        )

        return HttpResponse.json(
          envelope([conversation1, conversation2], conversationsPage),
        )
      }),
    )

    const user = userEvent.setup()
    renderWithProviders(<HistoryPanel />)

    await screen.findByRole('button', { name: '요통 진료 상담' })

    await user.type(screen.getByLabelText('대화 검색'), '요통')
    await user.click(screen.getByRole('button', { name: '검색' }))

    await waitFor(() => {
      expect(requestedQueries).toContain('요통')
    })
  })
})
