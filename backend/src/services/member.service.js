const memberRepository = require('../repositories/member.repository');
const HttpError = require('../utils/httpError');

async function listMembers(projectId) {
  return memberRepository.list(projectId);
}

async function searchAssignees(projectId, search) {
  return memberRepository.searchAssignees(projectId, search);
}

async function addMember(projectId, userId, projectRole) {
  try {
    return await memberRepository.add(projectId, userId, projectRole);
  } catch (error) {
    if (error.code === '23505') {
      throw new HttpError(409, 'MEMBER_ALREADY_EXISTS', 'User is already a project member');
    }
    if (error.code === '23503') {
      throw new HttpError(404, 'USER_NOT_FOUND', 'User not found');
    }
    throw error;
  }
}

async function updateMember(projectId, userId, projectRole) {
  const member = await memberRepository.updateRole(projectId, userId, projectRole);
  if (!member) {
    throw new HttpError(404, 'MEMBER_NOT_FOUND', 'Project member not found');
  }
  return member;
}

async function removeMember(projectId, userId) {
  if (!await memberRepository.remove(projectId, userId)) {
    throw new HttpError(404, 'MEMBER_NOT_FOUND', 'Project member not found');
  }
}

module.exports = {
  addMember,
  listMembers,
  removeMember,
  searchAssignees,
  updateMember,
};
