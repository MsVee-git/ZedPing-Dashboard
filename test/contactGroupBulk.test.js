import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const app = fs.readFileSync(path.join(here, "..", "src", "App.tsx"), "utf8");
const importer = fs.readFileSync(path.join(here, "..", "src", "ContactsImport.tsx"), "utf8");

test("Contacts supports bulk contact selection and one Add to Group action", () => {
  assert.match(app, /Select all matching contacts/);
  assert.match(app, /Add to Group/);
  assert.match(app, /members\/batch/);
  assert.match(app, /contact_ids: contactIds/);
  assert.match(app, /already_member_count/);
});

test("new groups offer existing-contact, upload, and empty creation paths", () => {
  assert.match(app, /Select Existing Contacts/);
  assert.match(app, /Upload Contacts/);
  assert.match(app, /Create Empty Group/);
  assert.match(app, /fixedGroup=\{importGroup\}/);
  assert.match(importer, /fixedGroup/);
  assert.match(importer, /group_id:fixedGroup\?\.id\|\|groupId\|\|null/);
});

test("group detail supports member search, bulk selection, and membership-only removal", () => {
  assert.match(app, /Search group members/);
  assert.match(app, /Remove \{selectedMemberIds\.size\} from Group/);
  assert.match(app, /removeMembers/);
  assert.doesNotMatch(app, /deleteContact/);
});

