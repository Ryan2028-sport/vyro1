/**
 * Commit message enforcement for VYRO.
 *
 * Every commit — human or AI-authored — follows Conventional Commits.
 * This config is the contract; CI rejects anything that doesn't meet it.
 */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'perf', 'refactor', 'docs', 'test', 'build', 'ci', 'chore', 'revert'],
    ],
    'scope-enum': [
      2,
      'always',
      [
        'band', 'ble', 'ota', 'readiness', 'sleep', 'sport', 'video',
        'ui', 'auth', 'db', 'deps', 'repo',
      ],
    ],
    'scope-empty': [1, 'never'],
    'subject-case': [2, 'always', 'lower-case'],
    'subject-full-stop': [2, 'never', '.'],
    'header-max-length': [2, 'always', 72],
    'body-leading-blank': [2, 'always'],
  },
};
