export class ApiError extends Error {
  constructor(status, code, message, field) {
    super(message || 'Request failed');
    this.name = 'ApiError';
    this.status = status;
    this.code = code || 'error';
    this.field = field || null;
  }
}

async function request(path, { method = 'GET', body } = {}) {
  let response;
  try {
    response = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'network', 'Network error');
  }
  const contentType = response.headers.get('content-type') || '';
  let data = null;
  if (contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  }
  if (!response.ok) {
    const error = data && data.error ? data.error : {};
    throw new ApiError(response.status, error.code || 'error', error.message, error.field);
  }
  return data;
}

export const api = {
  health: () => request('/api/health'),

  me: () => request('/api/auth/me'),
  login: (email, password) => request('/api/auth/login', { method: 'POST', body: { email, password } }),
  register: (payload) => request('/api/auth/register', { method: 'POST', body: payload }),
  logout: () => request('/api/auth/logout', { method: 'POST', body: {} }),
  updateMe: (payload) => request('/api/me', { method: 'PATCH', body: payload }),
  lastViewed: (subjectId, topicId) =>
    request('/api/me/last-viewed', { method: 'POST', body: { subjectId, topicId } }),
  progress: () => request('/api/me/progress'),
  attempts: () => request('/api/me/attempts'),

  content: () => request('/api/content'),
  topic: (id) => request(`/api/topics/${encodeURIComponent(id)}`),
  practice: (id) => request(`/api/practice/${encodeURIComponent(id)}`),
  quiz: (id) => request(`/api/quiz/${encodeURIComponent(id)}`),
  exam: (id) => request(`/api/exam/${encodeURIComponent(id)}`),
  submitAttempt: (payload) => request('/api/attempts', { method: 'POST', body: payload }),
  attempt: (id) => request(`/api/attempts/${encodeURIComponent(id)}`),

  teacherContent: () => request('/api/teacher/content'),
  teacherUpdateSubject: (id, payload) =>
    request(`/api/teacher/subjects/${encodeURIComponent(id)}`, { method: 'PATCH', body: payload }),
  teacherCreateSubject: (payload) => request('/api/teacher/subjects', { method: 'POST', body: payload }),
  teacherDeleteSubject: (id) =>
    request(`/api/teacher/subjects/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  teacherCreateTopic: (subjectId, payload) =>
    request(`/api/teacher/subjects/${encodeURIComponent(subjectId)}/topics`, { method: 'POST', body: payload }),
  teacherUpdateTopic: (id, payload) =>
    request(`/api/teacher/topics/${encodeURIComponent(id)}`, { method: 'PATCH', body: payload }),
  teacherDeleteTopic: (id) =>
    request(`/api/teacher/topics/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  teacherUpdateExam: (subjectId, payload) =>
    request(`/api/teacher/subjects/${encodeURIComponent(subjectId)}/exam`, { method: 'PATCH', body: payload }),
  teacherImport: (content) => request('/api/teacher/import', { method: 'POST', body: { content } }),
};
