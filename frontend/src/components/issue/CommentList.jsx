import { useState } from 'react';

export default function CommentList({ comments, currentUserId, projectRole, onEdit, onDelete }) {
  const [editingId, setEditingId] = useState(null);
  const [content, setContent] = useState('');

  async function save(comment) {
    await onEdit(comment.id, content);
    setEditingId(null);
  }

  return (
    <div className="comment-list">
      {comments.map((comment) => {
        const isAuthor = comment.user_id === currentUserId;
        const canEdit = isAuthor && ['admin', 'member'].includes(projectRole);
        const canDelete = projectRole === 'admin' || (isAuthor && projectRole === 'member');
        return (
          <article key={comment.id} className="comment">
            <header><strong>{comment.user_name ?? `User ${comment.user_id}`}</strong><time>{new Date(comment.created_at).toLocaleString()}</time></header>
            {editingId === comment.id ? (
              <div className="inline-edit">
                <textarea value={content} onChange={(event) => setContent(event.target.value)} />
                <button type="button" onClick={() => save(comment)}>Save</button>
              </div>
            ) : <p>{comment.content}</p>}
            <footer>
              {canEdit && <button type="button" onClick={() => { setEditingId(comment.id); setContent(comment.content); }}>Edit</button>}
              {canDelete && <button type="button" onClick={() => onDelete(comment.id)}>Delete</button>}
            </footer>
          </article>
        );
      })}
    </div>
  );
}
