// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

/**
 * docs/specs/07 수용 기준 10 동결 테스트. 구현 중 수정 금지.
 */

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
}));

const mutateAsyncMock = vi.fn(async () => ({}));
vi.mock('../api/auth.api', () => ({
  useLogin: () => ({ mutateAsync: mutateAsyncMock, isPending: false, error: null }),
}));

import { LoginForm } from './login-form';

describe('LoginForm (수용 기준 10)', () => {
  it('제출 → login mutation 호출 + 성공 시 /assistant 이동', async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText('이메일'), 'doctor@clinic.kr');
    await user.type(screen.getByLabelText('비밀번호'), 'password-1234');
    await user.click(screen.getByRole('button', { name: '로그인' }));

    expect(mutateAsyncMock).toHaveBeenCalledWith({
      email: 'doctor@clinic.kr',
      password: 'password-1234',
    });
    expect(pushMock).toHaveBeenCalledWith('/assistant');
  });
});
