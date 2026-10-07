import {expect, test, describe} from 'vitest'
import EmailDomainsActivity from '../../src/commands/email/domains/activity.js'
import EmailDomainsList from '../../src/commands/email/domains/list.js'
import EmailMessagesList from '../../src/commands/email/messages/list.js'
import EmailMessagesSource from '../../src/commands/email/messages/source.js'
import InboxesActivity from '../../src/commands/inboxes/activity.js'
import InboxesCreate from '../../src/commands/inboxes/create.js'
import InboxesEventsList from '../../src/commands/inboxes/events/list.js'
import InboxesList from '../../src/commands/inboxes/list.js'
import InboxesUpdate from '../../src/commands/inboxes/update.js'

describe('inbound surface gaps', () => {
  test('list and filter flags are on the commands', () => {
    expect(InboxesEventsList.flags).toHaveProperty('method')
    expect(InboxesEventsList.flags).toHaveProperty('path')
    expect(InboxesList.flags).toHaveProperty('search')
    expect(InboxesCreate.flags).toHaveProperty('response-header')
    expect(InboxesUpdate.flags).toHaveProperty('response-header')
    expect(EmailMessagesList.flags).toHaveProperty('query')
    expect(EmailDomainsList.flags).toHaveProperty('search')
  })

  test('activity and source commands exist', () => {
    expect(InboxesActivity.description).toMatch(/24 hours/)
    expect(EmailDomainsActivity.description).toMatch(/24 hours/)
    expect(EmailMessagesSource.args).toHaveProperty('messageId')
    expect(EmailMessagesSource.flags).toHaveProperty('to')
  })
})