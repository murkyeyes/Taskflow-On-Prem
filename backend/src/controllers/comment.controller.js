const commentService = require('../services/comment.service');
const {
  requireInteger,
  requireObject,
  requireString,
} = require('../utils/validation');

async function list(request, response) {
  response.json({ comments: await commentService.listComments(request.params.issueKey) });
}

async function create(request, response) {
  const body = requireObject(request.body);
  const comment = await commentService.createComment(
    request.params.issueKey,
    request.user.userId,
    requireString(body.content, 'content', { min: 1, max: 20_000 }),
  );
  response.status(201).json({ comment });
}

async function update(request, response) {
  const body = requireObject(request.body);
  const comment = await commentService.updateComment(
    requireInteger(request.params.id, 'id', { min: 1 }),
    request.user.userId,
    requireString(body.content, 'content', { min: 1, max: 20_000 }),
  );
  response.json({ comment });
}

async function remove(request, response) {
  await commentService.deleteComment(
    requireInteger(request.params.id, 'id', { min: 1 }),
    request.user.userId,
  );
  response.status(204).send();
}

module.exports = {
  create,
  list,
  remove,
  update,
};
