# Chat RLS + Smoke Test Checklist

Use this checklist after running:
- `20250219000001_department_chat_groups.sql`
- `20250219000002_chat_owner_guard_audit.sql`

## Test Personas

- `manager`: role `hospital_manager`
- `member`: staff user in target chat group
- `non_member`: staff user not in target chat group
- `patient`: role `patient`

## Preconditions

1. At least one active chat group exists (example: `General Staff`).
2. A second test group exists for membership operations.
3. You have credentials/tokens for all four personas.
4. Pick identifiers and fill them in:
   - `GROUP_ID`
   - `MEMBER_USER_ID`
   - `NON_MEMBER_USER_ID`
   - `PATIENT_USER_ID`

## RLS Matrix (Expected Outcomes)

### `employee_chat_groups`

| Persona | SELECT own groups | INSERT group | UPDATE group | DELETE group |
| --- | --- | --- | --- | --- |
| manager | allow | allow | allow | allow |
| member | allow (membership only) | deny | deny | deny |
| non_member | deny | deny | deny | deny |
| patient | deny | deny | deny | deny |

### `employee_chat_group_members`

| Persona | SELECT memberships | INSERT membership | UPDATE membership | DELETE membership |
| --- | --- | --- | --- | --- |
| manager | allow | allow | allow | allow (except last-owner guard) |
| member | allow (self only) | deny | deny | deny |
| non_member | deny | deny | deny | deny |
| patient | deny | deny | deny | deny |

### `employee_chat_messages`

| Persona | SELECT messages in group | INSERT message in group | DELETE own message in group |
| --- | --- | --- | --- |
| manager | allow (if member of group) | allow (if member of group) | allow (own only) |
| member | allow (own groups) | allow (own groups) | allow (own only, own groups) |
| non_member | deny | deny | deny |
| patient | deny | deny | deny |

## RLS Verification Steps

For each persona, run equivalent `SELECT/INSERT/DELETE` operations against all three chat tables and compare to expected outcomes above.

Minimum SQL probes:

```sql
-- groups read
select id, name, is_active from public.employee_chat_groups order by name;

-- groups write (manager should pass, others should fail)
insert into public.employee_chat_groups (name, is_active) values ('RLS Test Group', true);

-- memberships read
select group_id, user_id, role_in_group from public.employee_chat_group_members;

-- memberships write (manager only, plus guard checks below)
insert into public.employee_chat_group_members (group_id, user_id, role_in_group)
values ('GROUP_ID', 'MEMBER_USER_ID', 'member');

-- messages read
select id, group_id, sender_id, message from public.employee_chat_messages
where group_id = 'GROUP_ID'
order by created_at desc
limit 20;

-- messages write
insert into public.employee_chat_messages (group_id, sender_id, sender_name, sender_role, message)
values ('GROUP_ID', auth.uid(), 'RLS Tester', 'staff', 'RLS smoke message');
```

## Owner Guardrail Checks (Manager Persona)

1. Ensure a test group has exactly one owner.
2. Attempt to remove that owner from `employee_chat_group_members`.
3. Attempt to demote that owner role from `owner` to `member`.
4. Expected: both operations fail with guardrail exception.
5. Add a second owner, then retry removal/demotion of first owner.
6. Expected: operation succeeds when another owner remains.

## End-to-End Smoke Flow

1. Create group.
2. Add member.
3. Member posts message.
4. Remove member.
5. Verify access revoked:
   - removed member cannot `SELECT` group messages,
   - removed member cannot `INSERT` new group message.

## Chat Admin Audit Coverage

Verify records appear in `public.chat_admin_audit_log` for:
- `group_created`
- `group_archived` and `group_reactivated`
- `member_added`
- `member_removed`
- `member_role_changed` (if tested)

Manager should also see these events in Institution Audit Trail UI.

## Evidence Log Template

| Timestamp | Persona | Action | Expected | Observed | Pass/Fail | Notes |
| --- | --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |
