import {expect, test, describe} from 'vitest'
import EmailDomainsActivity from '../../src/commands/email/domains/activity.js'
import EmailDomainsList from '../../src/commands/email/domains/list.js'
import EmailMessagesList from '../../src/commands/email/messages/list.js'
import EmailMessagesDelete from '../../src/commands/email/messages/delete.js'
import EmailMessagesLinks from '../../src/commands/email/messages/links.js'
import EmailMessagesOtp from '../../src/commands/email/messages/otp.js'
import EmailMessagesSource from '../../src/commands/email/messages/source.js'
import InboxesActivity from '../../src/commands/inboxes/activity.js'
import InboxesCreate from '../../src/commands/inboxes/create.js'
import InboxesEventsDelete from '../../src/commands/inboxes/events/delete.js'
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

  test('message otp, links, delete and event delete commands exist', () => {
    for (const cmd of [EmailMessagesOtp, EmailMessagesLinks, EmailMessagesDelete]) {
      expect(cmd.args).toHaveProperty('messageId')
      expect(cmd.flags).toHaveProperty('to')
    }
    expect(EmailMessagesDelete.flags).toHaveProperty('yes')
    expect(InboxesEventsDelete.args).toHaveProperty('id')
    expect(InboxesEventsDelete.args).toHaveProperty('eventId')
    expect(InboxesEventsDelete.flags).toHaveProperty('yes')
  })
})
