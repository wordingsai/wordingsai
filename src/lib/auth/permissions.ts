import { createAccessControl } from "better-auth/plugins/access";

const statement = {
  project: [
    "manage_companies",
    "manage_users",
    "manage_contracts",
    "clause_library_management",
    "provide_user_access",
    "upload_documents",
    "manage_clause_databases",
    "export_pdf",
    "view_file",
    "review",
  ],
  organization: ["update", "delete"] as const,
  member: ["create", "update", "delete"] as const,
  invitation: ["create", "cancel"] as const,
} as const;

const ac = createAccessControl(statement);

const psa = ac.newRole({
  project: [
    "manage_companies",
    "manage_users",
    "manage_contracts",
    "clause_library_management",
    "provide_user_access",
    "upload_documents",
    "manage_clause_databases",
    "export_pdf",
    "view_file",
    "review",
  ],
  organization: ["update", "delete"],
  member: ["create", "update", "delete"],
  invitation: ["create", "cancel"],
});

// Super User (SU)
const su = ac.newRole({
  project: [
    "clause_library_management",
    "provide_user_access",
    "upload_documents",
    "manage_clause_databases",
    "manage_contracts",
    "export_pdf",
    "view_file",
    "review",
  ],
  organization: ["update", "delete"],
  member: ["create", "update", "delete"],
  invitation: ["create", "cancel"],
});

// Normal User
const u = ac.newRole({
  project: ["view_file", "review"],
});

export { ac, psa, su, u, statement };
