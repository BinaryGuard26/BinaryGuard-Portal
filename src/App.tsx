import { FormEvent, useEffect, useMemo, useState } from "react";
import "./styles/portal.css";
import { requestOtp, verifyOtp } from "./services/api";

type Page = "auth" | "register" | "otp" | "services" | "checking" | "denied" | "order" | "success";

type Order = {
  id: string;
  reference: string;
  request_type: string;
  cardholder_name: string;
  cardholder_email: string;
  employee_id: string;
  department: string;
  site_name: string;
  building_address: string;
  floor: string;
  access_level: string;
  effective_date: string;
  expiry_date: string;
  notes: string;
  status: string;
};

const tenant = {
  name: "Government of Manitoba",
  approvedEmailDomain: "@gov.mb.ca",
  active: true,
  services: { access_card_ordering: true }
};

const dropdownOptions = {
  request_type: ["New Card", "Replacement Card", "Temporary Card", "Cancel Card", "Access Change"],
  access_level: ["Standard Access", "Manager Access", "Restricted Area Access"],
  site: ["Winnipeg Central Office", "Brandon Regional Office", "Thompson Service Centre"],
  building: ["Government Administration Building", "Norquay Building", "Woodsworth Building"]
};

const pageTitles: Record<Page, [string, string]> = {
  auth: ["SECURE ACCESS", "Welcome to BinaryGuard"],
  register: ["USER REGISTRATION", "User Registration"],
  otp: ["IDENTITY VERIFICATION", "Enter your security code"],
  services: ["CLIENT PORTAL", "Authorized services"],
  checking: ["SERVICE AUTHORIZATION", "Checking access"],
  denied: ["SERVICE AUTHORIZATION", "Access denied"],
  order: ["SECURE ORDERING", "Access Card Ordering"],
  success: ["REQUEST CONFIRMATION", "Order submitted"]
};

const blankOrder = {
  request_type: "",
  cardholder_name: "",
  cardholder_email: "",
  employee_id: "",
  department: "",
  site_name: "",
  building_address: "",
  floor: "",
  access_level: "",
  effective_date: "",
  expiry_date: "",
  notes: ""
};

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join("") || "BG";
}

function reference() {
  return `ACO-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900000 + 100000))}`;
}

export default function App() {
  const [page, setPage] = useState<Page>("auth");
  const [statusText, setStatusText] = useState("Not verified");
  const [statusOk, setStatusOk] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpExpiresAt, setOtpExpiresAt] = useState<number | null>(null);
  const [otpSecondsLeft, setOtpSecondsLeft] = useState(0);
  const [otpCode, setOtpCode] = useState("");
  const [otpPurpose, setOtpPurpose] = useState<"registration" | "login">("login");
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [user, setUser] = useState({ name: "John Smith", email: "john.smith@gov.mb.ca", org: tenant.name });
  const [registration, setRegistration] = useState({
    fullName: "",
    corporateEmail: "",
    organization: tenant.name,
    department: "",
    requestedRole: "standard_user",
    reason: ""
  });
  const [orderForm, setOrderForm] = useState(blankOrder);

  const title = pageTitles[page];
  const steps = ["auth", "otp", "services", "order"];
  const activeStep = page === "checking" || page === "denied" ? "services" : page === "success" ? "order" : page;
  const activeStepIndex = Math.max(0, steps.indexOf(activeStep));
  const summary = useMemo(() => ({
    total: orders.length,
    active: orders.filter(order => !["Completed", "Cancelled", "Rejected"].includes(order.status)).length,
    completed: orders.filter(order => order.status === "Completed").length
  }), [orders]);

  function toast(message: string) {
    setToastMessage(message);
    window.setTimeout(() => setToastMessage(""), 3200);
  }

  function showPage(next: Page) {
    setPage(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  useEffect(() => {
    if (otpExpiresAt === null) {
      setOtpSecondsLeft(0);
      return;
    }

    const updateCountdown = () => {
      const seconds = Math.max(0, Math.ceil((otpExpiresAt - Date.now()) / 1000));
      setOtpSecondsLeft(seconds);
    };

    updateCountdown();
    const timer = window.setInterval(updateCountdown, 1000);

    return () => window.clearInterval(timer);
  }, [otpExpiresAt]);

  function startOtpTimer(minutes: number) {
    setOtpExpiresAt(Date.now() + minutes * 60 * 1000);
  }

  function formatOtpTime(totalSeconds: number) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }

  async function resendOtp() {
    try {
      setOtpLoading(true);
      const result = await requestOtp(user.email, otpPurpose);

      if (!result.ok) {
        toast(result.message || "Unable to resend OTP.");
        return;
      }

      setOtpCode("");
      startOtpTimer(result.expires_in_minutes || 10);
      toast("A new OTP has been sent to your email.");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Unable to resend OTP.");
    } finally {
      setOtpLoading(false);
    }
  }

  function signOut() {
    setStatusText("Not verified");
    setStatusOk(false);
    setOtpCode("");
    setOtpExpiresAt(null);
    showPage("auth");
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!user.email.toLowerCase().endsWith(tenant.approvedEmailDomain)) {
      toast("This email domain is not approved for portal access.");
      return;
    }

    try {
      setOtpLoading(true);
      setOtpPurpose("login");
      const result = await requestOtp(user.email, "login");

      if (!result.ok) {
        toast(result.message || "Unable to send OTP.");
        return;
      }

      setOtpCode("");
      setStatusText("OTP required");
      setStatusOk(false);
      startOtpTimer(result.expires_in_minutes || 10);
      toast("A six-digit OTP has been sent to your email.");
      showPage("otp");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Unable to send OTP.");
    } finally {
      setOtpLoading(false);
    }
  }

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const email = registration.corporateEmail.trim().toLowerCase();

    if (!email.endsWith(tenant.approvedEmailDomain)) {
      toast("Registration is limited to approved organization email addresses.");
      return;
    }

    try {
      setOtpLoading(true);
      setOtpPurpose("registration");
      const result = await requestOtp(email, "registration");

      if (!result.ok) {
        toast(result.message || "Unable to send OTP.");
        return;
      }

      setUser({
        name: registration.fullName || "Portal User",
        email,
        org: registration.organization || tenant.name,
      });
      setOtpCode("");
      setStatusText("OTP required");
      setStatusOk(false);
      startOtpTimer(result.expires_in_minutes || 10);
      toast("Registration request received. OTP sent to your corporate email.");
      showPage("otp");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Unable to send OTP.");
    } finally {
      setOtpLoading(false);
    }
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setOtpLoading(true);
      const result = await verifyOtp(user.email, otpCode, otpPurpose);

      if (!result.ok) {
        toast(result.message || "Invalid OTP code.");
        return;
      }

      setStatusText("Verified");
      setStatusOk(true);
      toast("OTP verified successfully.");
      showPage("services");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Unable to verify OTP.");
    } finally {
      setOtpLoading(false);
    }
  }

  function openService() {
    showPage("checking");
    window.setTimeout(() => {
      if (statusOk && tenant.active && tenant.services.access_card_ordering) showPage("order");
      else showPage("denied");
    }, 800);
  }

  function resetOrder() {
    setEditingOrderId(null);
    setOrderForm(blankOrder);
  }

  function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (editingOrderId) {
      setOrders(current => current.map(order => order.id === editingOrderId ? { ...order, ...orderForm } : order));
      resetOrder();
      toast("Request updated.");
      showPage("services");
      return;
    }
    const newOrder: Order = { id: crypto.randomUUID(), reference: reference(), ...orderForm, status: "Submitted" };
    setOrders(current => [newOrder, ...current]);
    resetOrder();
    showPage("success");
  }

  function editOrder(orderId: string) {
    const found = orders.find(order => order.id === orderId);
    if (!found) return;
    setEditingOrderId(orderId);
    setOrderForm({
      request_type: found.request_type,
      cardholder_name: found.cardholder_name,
      cardholder_email: found.cardholder_email,
      employee_id: found.employee_id,
      department: found.department,
      site_name: found.site_name,
      building_address: found.building_address,
      floor: found.floor,
      access_level: found.access_level,
      effective_date: found.effective_date,
      expiry_date: found.expiry_date,
      notes: found.notes
    });
    showPage("order");
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">BG</span><div><strong>BinaryGuard</strong><small>Secure Client Portal</small></div></div>
        <div className="secure-chip"><span></span> portal.binaryguard.ca</div>
        <nav className="journey" aria-label="Portal progress">
          {[["auth","User Authentication","Login or registration request"],["otp","OTP Verification","One-time passcode"],["services","Service Authorization","Tenant & role access"],["order","Access Card Portal","Secure ordering"]].map(([key,label,helper], index) => (
            <button key={key} className={`journey-step ${index === activeStepIndex ? "active" : index < activeStepIndex ? "done" : "locked"}`} onClick={() => index <= activeStepIndex && showPage(key as Page)}>
              <i>{index < activeStepIndex ? "✓" : index + 1}</i><span><b>{label}</b><small>{helper}</small></span>
            </button>
          ))}
        </nav>
        <div className="security-card"><span className="shield">✓</span><div><strong>Protected workflow</strong><p>Each layer is verified before the next becomes available.</p></div></div>
      </aside>

      <main>
        <header className="topbar">
          <div><p className="eyebrow">{title[0]}</p><h1>{title[1]}</h1></div>
          {page !== "auth" && <div className="session"><span className="avatar">{initials(user.name)}</span><div><b>{user.name}</b><small>{user.org}</small></div><button className="text-btn" onClick={signOut}>Sign out</button></div>}
          <span className={`status ${statusOk ? "ok" : ""}`}><i></i> {statusText}</span>
        </header>

        <section className={`page ${page === "auth" ? "active" : ""}`}>
          <div className="hero"><span className="hero-icon">→</span><div><p className="eyebrow">LAYER 1</p><h2>Corporate access login</h2><p>Use your approved organization email to enter the secure client portal.</p></div></div>
          <form className="card compact" onSubmit={login}>
            <label>Corporate email address<input type="email" value={user.email} onChange={e => setUser({ ...user, email: e.target.value })} required /></label>
            <button className="primary" type="submit" disabled={otpLoading}>{otpLoading ? "Sending OTP..." : "Continue securely"} <span>→</span></button>
            <p className="form-note">Users cannot continue until a registration request is approved in Admin CPanel.</p>
            <div className="split-actions">
              <button
                className="text-btn"
                type="button"
                onClick={() => showPage("register")}
              >
                User Registration
              </button>
            </div>
          </form>
        </section>

        <section className={`page ${page === "register" ? "active" : ""}`}>
          <div className="hero">
            <span className="hero-icon">+</span>
            <div>
              <p className="eyebrow">USER REGISTRATION</p>
              <h2>User Registration</h2>
              <p>Complete the form below to request access to the BinaryGuard Secure Client Portal. Your request will be reviewed by your administrator before access is granted.</p>
            </div>
          </div>

          <form className="card" onSubmit={register}>
            <div className="form-grid">
              <label>
                Full name *
                <input
                  value={registration.fullName}
                  onChange={e => setRegistration({ ...registration, fullName: e.target.value })}
                  required
                />
              </label>

              <label>
                Corporate email *
                <input
                  type="email"
                  value={registration.corporateEmail}
                  onChange={e => setRegistration({ ...registration, corporateEmail: e.target.value })}
                  required
                />
              </label>

              <label>
                Organization *
                <input value={registration.organization} readOnly />
              </label>

              <label>
                Requested Access Level *
                <select
                  value={registration.requestedRole}
                  onChange={e => setRegistration({ ...registration, requestedRole: e.target.value })}
                  required
                >
                  <option value="standard_user">Standard User</option>
                  <option value="operator">Operator</option>
                </select>
              </label>

              <label>
                Department *
                <input
                  value={registration.department}
                  onChange={e => setRegistration({ ...registration, department: e.target.value })}
                  required
                />
              </label>

              <label>
                Reason for access *
                <input
                  value={registration.reason}
                  onChange={e => setRegistration({ ...registration, reason: e.target.value })}
                  required
                />
              </label>
            </div>
            

            <section className="workflow-section">
              <div className="workflow-heading">
                <p className="eyebrow">User Registration Process</p>
                <h3>User registration workflow</h3>
                <p>These are the steps a user follows before access is activated.</p>
              </div>

              <div className="registration-flow-cards">
                <article>
                  <div className="flow-icon">👤</div>
                  <div>
                    <h4>1. User submits request</h4>
                    <p>Submit your registration request with required details.</p>
                  </div>
                </article>

                <article>
                  <div className="flow-icon">盾</div>
                  <div>
                    <h4>2. OTP Verification</h4>
                    <p>Verify your identity using the one-time password (OTP).</p>
                  </div>
                </article>

                <article>
                  <div className="flow-icon">✓</div>
                  <div>
                    <h4>3. Account Activation</h4>
                    <p>Your account will be activated after successful verification.</p>
                  </div>
                </article>
              </div>
            </section>

            <section className="workflow-section">
              <div className="workflow-heading">
                <p className="eyebrow">Operator Registration Process</p>
                <h3>Operator registration workflow</h3>
                <p>These steps show how an operator-submitted request is reviewed and approved.</p>
              </div>

              <div className="registration-flow-cards approval-flow-cards">
                <article>
                  <div className="flow-icon">🤵🏻</div>
                  <div>
                    <h4>1. Operator submits request</h4>
                    <p>User registration request is submitted for approval.</p>
                  </div>
                </article>

                <article>
                  <div className="flow-icon">▣</div>
                  <div>
                    <h4>2. Admin CPanel review</h4>
                    <p>Administrator reviews and approves the registration request.</p>
                  </div>
                </article>

                <article>
                  <div className="flow-icon">✓</div>
                  <div>
                    <h4>3. Account activated</h4>
                    <p>User receives approval and can access the Client Portal.</p>
                  </div>
                </article>
              </div>
            </section>

            <div className="form-actions">
              <p><span>✓</span> Creates a pending user registration request.</p>
              <button className="secondary" type="button" onClick={() => showPage("auth")}>Back to login</button>
              <button className="primary" type="submit" disabled={otpLoading}>{otpLoading ? "Sending OTP..." : "Submit registration request"} <span>→</span></button>
            </div>
          </form>
        </section>

        <section className={`page ${page === "otp" ? "active" : ""}`}>
          <div className="hero"><span className="hero-icon">••</span><div><p className="eyebrow">LAYER 2</p><h2>Verify your identity</h2><p>We sent a six-digit code to <b>{user.email}</b>. It expires in 5 minutes.</p></div></div>
          <form className="card compact" onSubmit={verify}>
            <label>
              Verification code
              <input
                value={otpCode}
                onChange={e => setOtpCode(e.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                maxLength={6}
                required
              />
            </label>

            <div className="otp-timer-panel">
              {otpSecondsLeft > 0 ? (
                <>
                  <span className="otp-timer-label">Code expires in</span>
                  <strong>{formatOtpTime(otpSecondsLeft)}</strong>
                </>
              ) : (
                <>
                  <span className="otp-timer-label">OTP expired</span>
                  <button className="text-btn" type="button" onClick={resendOtp} disabled={otpLoading}>
                    {otpLoading ? "Sending..." : "Resend OTP"}
                  </button>
                </>
              )}
            </div>

            <div className="code-meta">
              <span>Use the code sent to your email.</span>
              <span>3 attempts maximum</span>
            </div>

            <button className="primary" type="submit" disabled={otpLoading || otpSecondsLeft <= 0}>
              {otpLoading ? "Verifying..." : "Verify & continue"} <span>→</span>
            </button>
          </form>
        </section>

        <section className={`page ${page === "services" ? "active" : ""}`}>
          <div className="hero"><span className="hero-icon">⌘</span><div><p className="eyebrow">AUTHORIZED SERVICES</p><h2>Good morning, {user.name.split(" ")[0]}</h2><p>Select a service available to <span>{tenant.name}</span>.</p></div></div>
          <div className="service-grid"><article className="service-card featured"><div className="service-top"><span className="service-icon">▣</span><span className="approved">Enabled</span></div><h3>Access Card Ordering</h3><p>Request new, replacement, temporary, or updated access cards for your organization.</p><button className="primary" onClick={openService}>Open Access Card Ordering <span>→</span></button></article><article className="service-card muted"><div className="service-top"><span className="service-icon">◉</span><span className="soon">Coming soon</span></div><h3>Camera Ordering</h3><p>Order security camera equipment and supporting services.</p></article><article className="service-card muted"><div className="service-top"><span className="service-icon">◇</span><span className="soon">Coming soon</span></div><h3>Quote Requests</h3><p>Request a tailored quote from the BinaryGuard team.</p></article></div>
          <section className="client-dashboard"><div className="dashboard-heading"><div><p className="eyebrow">MY DASHBOARD</p><h2>Submitted requests</h2><p>Review, edit, modify, or delete your submitted access card requests.</p></div><button className="secondary" type="button">Refresh</button></div><div className="client-summary"><article><b>{summary.total}</b><span>Total submitted</span></article><article><b>{summary.active}</b><span>Active requests</span></article><article><b>{summary.completed}</b><span>Completed</span></article></div><div className="client-request-list">{orders.length === 0 ? <article className="empty-state"><h3>No submitted requests yet</h3><p>Use Access Card Ordering to create your first request. It will appear here after submission.</p></article> : <div className="table-wrap"><table><thead><tr><th>Reference</th><th>Request type</th><th>Cardholder</th><th>Site</th><th>Status</th><th>Actions</th></tr></thead><tbody>{orders.map(o => <tr key={o.id}><td>{o.reference}</td><td>{o.request_type}</td><td>{o.cardholder_name}</td><td>{o.site_name}</td><td><span className="pill">{o.status}</span></td><td className="row-actions"><button className="secondary small" onClick={() => toast(`${o.reference}: ${o.status}`)}>View</button><button className="secondary small" onClick={() => editOrder(o.id)}>Edit</button><button className="danger small" onClick={() => setOrders(current => current.filter(x => x.id !== o.id))}>Delete</button></td></tr>)}</tbody></table></div>}</div></section>
        </section>

        <section className={`page ${page === "checking" ? "active" : ""}`}><div className="gate-card"><div className="spinner"></div><p className="eyebrow">SECURE CHECK</p><h2>Verifying service authorization</h2><p>We’re confirming your account activation, organization, service access, and role before loading the order form.</p><ul><li className="checked">Authenticated user</li><li className="checked">Activated user account</li><li className="checked">Active tenant</li><li className="checked">Access Card Ordering enabled</li><li className="checked">Authorized user role</li></ul></div></section>
        <section className={`page ${page === "denied" ? "active" : ""}`}><div className="gate-card denied"><span className="denied-icon">!</span><p className="eyebrow">ACCESS DENIED</p><h2>You are not authorized</h2><p>You are not authorized to use the Access Card Ordering service.</p><button className="secondary" onClick={() => showPage("services")}>Return to services</button></div></section>

        <section className={`page ${page === "order" ? "active" : ""}`}>
          <div className="order-heading"><div><p className="eyebrow">ACCESS CARD ORDERING</p><h2>{editingOrderId ? "Edit access card request" : "New access card request"}</h2><p>{editingOrderId ? "Modify the request details below and save your changes." : "Complete the details below. Required fields are marked with an asterisk."}</p></div><span className="draft">{editingOrderId ? "Edit mode" : "Secure form"}</span></div>
          <form onSubmit={submitOrder}>
            <section className="form-section"><div className="section-title"><span>01</span><div><h3>Requester</h3><p>Loaded from your secure account</p></div><b className="readonly-pill">Read only</b></div><div className="identity-grid"><div><small>Requester</small><strong>{user.name}</strong></div><div><small>Email</small><strong>{user.email}</strong></div><div><small>Organization</small><strong>{user.org}</strong></div></div></section>
            <section className="form-section"><div className="section-title"><span>02</span><div><h3>Request information</h3><p>Tell us what kind of card request this is</p></div></div><div className="form-grid"><label>Request type *<select value={orderForm.request_type} onChange={e => setOrderForm({ ...orderForm, request_type: e.target.value })} required><option value="">Select an option</option>{dropdownOptions.request_type.map(x => <option key={x}>{x}</option>)}</select></label></div></section>
            <section className="form-section"><div className="section-title"><span>03</span><div><h3>Cardholder information</h3><p>Who is this access card for?</p></div></div><div className="form-grid"><label>Cardholder name *<input value={orderForm.cardholder_name} onChange={e => setOrderForm({ ...orderForm, cardholder_name: e.target.value })} required /></label><label>Cardholder email *<input type="email" value={orderForm.cardholder_email} onChange={e => setOrderForm({ ...orderForm, cardholder_email: e.target.value })} required /></label><label>Employee ID *<input value={orderForm.employee_id} onChange={e => setOrderForm({ ...orderForm, employee_id: e.target.value })} required /></label><label>Department *<input value={orderForm.department} onChange={e => setOrderForm({ ...orderForm, department: e.target.value })} required /></label></div></section>
            <section className="form-section"><div className="section-title"><span>04</span><div><h3>Site & access</h3><p>Tenant-specific options are loaded automatically</p></div></div><div className="form-grid"><label>Site *<select value={orderForm.site_name} onChange={e => setOrderForm({ ...orderForm, site_name: e.target.value })} required><option value="">Select an option</option>{dropdownOptions.site.map(x => <option key={x}>{x}</option>)}</select></label><label>Building *<select value={orderForm.building_address} onChange={e => setOrderForm({ ...orderForm, building_address: e.target.value })} required><option value="">Select an option</option>{dropdownOptions.building.map(x => <option key={x}>{x}</option>)}</select></label><label>Floor / Area<input value={orderForm.floor} onChange={e => setOrderForm({ ...orderForm, floor: e.target.value })} /></label><label>Access level *<select value={orderForm.access_level} onChange={e => setOrderForm({ ...orderForm, access_level: e.target.value })} required><option value="">Select an option</option>{dropdownOptions.access_level.map(x => <option key={x}>{x}</option>)}</select></label></div></section>
            <section className="form-section"><div className="section-title"><span>05</span><div><h3>Dates & notes</h3><p>Optional expiry date can be added for temporary cards</p></div></div><div className="form-grid"><label>Effective date *<input type="date" value={orderForm.effective_date} onChange={e => setOrderForm({ ...orderForm, effective_date: e.target.value })} required /></label><label>Expiry date <span className="optional">optional</span><input type="date" value={orderForm.expiry_date} onChange={e => setOrderForm({ ...orderForm, expiry_date: e.target.value })} /></label></div><label>Notes / remarks<textarea value={orderForm.notes} onChange={e => setOrderForm({ ...orderForm, notes: e.target.value })} /></label></section>
            <div className="form-actions"><p><span>✓</span> Submission will be routed to {tenant.name} processing queue.</p><div className="form-action-buttons"><button className="secondary" type="button" onClick={() => showPage("services")}>Back to services</button><button className="primary" type="submit">{editingOrderId ? "Save changes" : "Submit access card order"} <span>→</span></button></div></div>
          </form>
        </section>

        <section className={`page ${page === "success" ? "active" : ""}`}><div className="success-card"><span className="success-icon">✓</span><p className="eyebrow">ORDER SUBMITTED</p><h2>Your access card request has been received</h2><p>A confirmation will be sent to <b>{user.email}</b>. BinaryGuard will process the request according to the approved workflow.</p><div className="reference"><small>STATUS</small><strong>Submitted</strong><span>Pending review</span></div><div className="success-actions"><button className="primary" onClick={() => showPage("services")}>View my requests</button><button className="secondary" onClick={signOut}>Sign out</button></div></div></section>
        <div className={`toast ${toastMessage ? "show" : ""}`}>{toastMessage}</div>
      </main>
    </div>
  );
}
