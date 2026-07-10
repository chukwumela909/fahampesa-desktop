import { useState } from "react";
import {
  Users,
  UserPlus,
  Shield,
  Activity,
  RefreshCw,
  Search,
  Mail,
  Phone,
  Calendar,
  Eye,
  UserCheck,
  UserX,
  CheckCircle,
  XCircle,
} from "lucide-react";
import type { Role, StaffMember } from "@/data";
import { useAppData } from "@/store/AppData";
import Modal, { Field, SelectInput, TextInput } from "@/components/ui/Modal";

type Tab = "list" | "permissions" | "activity";

const roleColor: Record<StaffMember["role"], string> = {
  owner: "bg-purple-100 text-purple-800",
  manager: "bg-blue-100 text-blue-800",
  cashier: "bg-green-100 text-green-800",
};

export default function StaffScreen() {
  const { staff, staffLogs, branches, addStaff, toggleStaff, notify, online } = useAppData();
  const [tab, setTab] = useState<Tab>("list");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);

  const active = staff.filter((s) => s.status === "active").length;
  const managers = staff.filter((s) => s.role === "manager").length;
  const visible = staff.filter((s) => s.name.toLowerCase().includes(search.trim().toLowerCase()));

  // Resolve a staff member's assigned branches to names: prefer ids resolved against the
  // branch list (the backend serializes `assignedBranchIds`), falling back to any names sent.
  const branchNameById = new Map(branches.map((b) => [b.id, b.name]));
  const branchesFor = (member: StaffMember): string[] => {
    const fromIds = (member.branchIds ?? []).map((id) => branchNameById.get(id)).filter((n): n is string => Boolean(n));
    return fromIds.length > 0 ? fromIds : member.branches ?? [];
  };

  return (
    <div className="space-y-6" style={{ fontFamily: "var(--font-dm-sans)" }}>
      <div className="dashboard-panel flex flex-col gap-4 p-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="rounded-lg bg-blue-600 p-3">
            <Users className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="dashboard-page-title">Staff</h1>
            <p className="dashboard-page-subtitle mt-1">Manage team members and roles</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => notify("Staff refreshed")} className="dashboard-action-muted">
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </button>
          <button onClick={() => setCreating(true)} disabled={!online} title={online ? "Add staff member" : "Online only"} className="dashboard-action-primary disabled:cursor-not-allowed disabled:opacity-50">
            <UserPlus className="mr-2 h-4 w-4" /> Add staff member{!online && " (online only)"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={<Users className="h-6 w-6 text-blue-600" />} iconBg="bg-blue-50" label="Total Staff" value={String(staff.length)} />
        <StatCard icon={<UserCheck className="h-6 w-6 text-green-600" />} iconBg="bg-green-50" label="Active" value={String(active)} />
        <StatCard icon={<Shield className="h-6 w-6 text-slate-600" />} iconBg="bg-slate-50" label="Managers" value={String(managers)} />
        <StatCard icon={<Activity className="h-6 w-6 text-amber-600" />} iconBg="bg-amber-50" label="Recent Activities" value={String(staffLogs.length)} />
      </div>

      <div className="dashboard-panel p-1.5">
        <div className="grid grid-cols-3 gap-1">
          {([
            { id: "list", label: "Staff List", icon: Users },
            { id: "permissions", label: "Permissions", icon: Shield },
            { id: "activity", label: "Activity", icon: Activity },
          ] as const).map((item) => (
            <button key={item.id} onClick={() => setTab(item.id)} className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all ${tab === item.id ? "bg-white text-blue-600 shadow-sm" : "text-[#64748b] hover:text-[#0f172a]"}`}>
              <item.icon className="h-4 w-4" /> {item.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "list" && (
        <>
          <div className="dashboard-panel p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#94a3b8]" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search staff by name" className="dashboard-field w-full py-2.5 pl-10 pr-4 text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {visible.map((member) => (
              <div key={member.id} className="dashboard-panel group p-5">
                <div className="mb-4 flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-blue-50 p-3">
                      <div className="grid h-8 w-8 place-items-center rounded-lg bg-blue-600 text-sm font-bold text-white">{member.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}</div>
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-gray-900 group-hover:text-blue-700">{member.name}</p>
                      <span className={`mt-1 inline-flex items-center rounded-md px-2 py-1 text-xs font-medium capitalize ${roleColor[member.role]}`}>{member.role}</span>
                    </div>
                  </div>
                  <span className="flex items-center gap-1 text-xs font-medium">
                    {member.status === "active" ? (
                      <><CheckCircle className="h-4 w-4 text-green-500" /> <span className="text-green-600">Active</span></>
                    ) : (
                      <><XCircle className="h-4 w-4 text-gray-400" /> <span className="text-gray-500">Inactive</span></>
                    )}
                  </span>
                </div>

                <div className="space-y-2">
                  <Row icon={<Mail className="h-4 w-4 text-gray-400" />} text={member.email} />
                  <Row icon={<Phone className="h-4 w-4 text-gray-400" />} text={member.phone} />
                  <Row icon={<Calendar className="h-4 w-4 text-gray-400" />} text={`Last login: ${member.lastLogin}`} />
                </div>

                <div className="mt-4">
                  <p className="mb-2 text-sm font-medium text-gray-700">Assigned branches</p>
                  <div className="flex flex-wrap gap-1.5">
                    {branchesFor(member).length === 0 ? (
                      <span className="text-xs text-gray-400">No branches assigned</span>
                    ) : (
                      branchesFor(member).map((branch) => (
                        <span key={branch} className="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">{branch}</span>
                      ))
                    )}
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
                  <button onClick={() => notify(`Viewing ${member.name}`)} className="inline-flex flex-1 items-center justify-center gap-1 rounded-[10px] border border-[#e6ebf2] py-2 text-sm font-medium text-[#334155] transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700">
                    <Eye className="h-4 w-4" /> View
                  </button>
                  <button onClick={() => toggleStaff(member.id)} disabled={!online} className="inline-flex items-center justify-center rounded-[10px] border border-[#e6ebf2] px-3 py-2 text-sm font-medium text-[#334155] transition-colors hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-50" title={!online ? "Online only" : member.status === "active" ? "Deactivate" : "Activate"}>
                    {member.status === "active" ? <UserX className="h-4 w-4 text-red-500" /> : <UserCheck className="h-4 w-4 text-green-600" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === "permissions" && (
        <div className="dashboard-panel p-6">
          <div className="mb-4 flex items-center gap-2">
            <Shield className="h-5 w-5 text-[#004aad]" />
            <h3 className="dashboard-section-title">Role-Based Permissions</h3>
          </div>
          <div className="space-y-4">
            {(["owner", "manager", "cashier"] as const).map((role) => (
              <div key={role} className="rounded-lg border border-[#e6ebf2] p-6">
                <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium capitalize ${roleColor[role]}`}>{role}</span>
                <p className="mt-2 text-sm text-[#64748b]">
                  {role === "owner" ? "Full access to all branches, billing, staff, and sensitive financials." : role === "manager" ? "Branch operations, inventory, suppliers, and allowed reports." : "Sales register only — cost, profit and valuation are hidden."}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "activity" && (
        <div className="dashboard-panel p-5">
          {staffLogs.length === 0 ? (
            <div className="dashboard-empty-state px-6 py-16">
              <div className="flex flex-col items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-full bg-[#eef5ff] text-[#004aad]">
                  <Activity className="h-6 w-6" />
                </div>
                <h2 className="text-[18px] font-semibold text-[#0f172a]">No activity logs yet</h2>
                <p className="max-w-md text-[14px] text-[#64748b]">Staff sign-ins, sales, and edits will appear here as an audit trail.</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {staffLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 rounded-[12px] border border-[#e6ebf2] p-4">
                  <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full ${log.severity === "error" || log.severity === "critical" ? "bg-red-50 text-red-600" : log.severity === "warning" ? "bg-amber-50 text-amber-600" : "bg-[#eef5ff] text-[#004aad]"}`}>
                    <Activity className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2">
                      <p className="text-sm font-semibold text-[#0f172a]">{log.staffName}</p>
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-600">{log.action.replace(/_/g, " ")}</span>
                    </div>
                    <p className="text-sm text-[#64748b]">{log.description}</p>
                    <p className="mt-0.5 text-xs text-[#94a3b8]">{log.time}{log.branchName ? ` · ${log.branchName}` : ""}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {creating && (
        <AddStaffModal
          branchNames={branches.map((b) => b.name)}
          onClose={() => setCreating(false)}
          onSubmit={(data) => {
            const idByName = new Map(branches.map((b) => [b.name, b.id]));
            const branchIds = data.branches.map((n) => idByName.get(n)).filter((id): id is string => Boolean(id));
            addStaff({ ...data, branchIds, status: "active", lastLogin: "Never" });
            setCreating(false);
          }}
        />
      )}
    </div>
  );
}

function AddStaffModal({ branchNames, onClose, onSubmit }: { branchNames: string[]; onClose: () => void; onSubmit: (data: { name: string; email: string; phone: string; role: Role; branches: string[] }) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<Role>("cashier");
  const [branch, setBranch] = useState(branchNames[0] ?? "");
  const valid = name.trim() && email.trim();

  return (
    <Modal
      title="Add staff member"
      description="Invite a manager or cashier"
      size="lg"
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="dashboard-action-muted">Cancel</button>
          <button disabled={!valid} onClick={() => onSubmit({ name: name.trim(), email: email.trim(), phone: phone.trim() || "—", role, branches: branch ? [branch] : [] })} className="dashboard-action-primary disabled:opacity-50">
            Add staff
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Full name"><TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Team member name" /></Field>
        <Field label="Email"><TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@business.co.ke" /></Field>
        <Field label="Phone"><TextInput value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+254 …" /></Field>
        <Field label="Role">
          <SelectInput value={role} onChange={(e) => setRole(e.target.value as Role)}>
            <option value="manager">Manager</option>
            <option value="cashier">Cashier</option>
          </SelectInput>
        </Field>
        <Field label="Assigned branch">
          <SelectInput value={branch} onChange={(e) => setBranch(e.target.value)}>
            {branchNames.map((b) => <option key={b}>{b}</option>)}
          </SelectInput>
        </Field>
      </div>
    </Modal>
  );
}

function StatCard({ icon, iconBg, label, value }: { icon: React.ReactNode; iconBg: string; label: string; value: string }) {
  return (
    <div className="dashboard-panel flex items-center gap-4 p-5">
      <div className={`rounded-lg ${iconBg} p-3`}>{icon}</div>
      <div>
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
}

function Row({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-gray-600">
      {icon}
      <span className="truncate">{text}</span>
    </div>
  );
}
