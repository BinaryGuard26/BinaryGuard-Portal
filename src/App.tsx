import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import "./styles/portal.css";
import { requestOtp, verifyOtp } from "./services/api";
import { validateApprovedDomain } from "./services/domainService";

type Page = "auth" | "register" | "otp" | "services" | "checking" | "denied" | "order" | "success";

type Order = {
  id: string;
  reference: string;
  submitted_at: string;
  request_type: string;
  cardholder_name: string;
  employee_id: string;
  department: string;
  job_title: string;
  cardholder_email: string;
  contact_number: string;
  site_name: string;
  building_address: string;
  floor: string;
  office_number: string;
  department_location: string;
  card_type: string;
  quantity: number;
  access_level: string;
  card_format: string;
  replacement_reason: string;
  po_number: string;
  approved_by: string;
  delivery_address: string;
  receiving_person: string;
  delivery_phone: string;
  delivery_method: string;
  notes: string;
  status: string;
};

const tenant = {
  name: "Government of Manitoba",
  approvedEmailDomain: "@gov.mb.ca",
  approvedEmailDomains: ["@gov.mb.ca", "@binaryguard.ca"],
  active: true,
  services: { access_card_ordering: true }
};

const organizationOptions = [
  "Manitoba Housing",
  "BinaryGuard Innovations Inc."
];

const dropdownOptions = {
  request_type: ["New Card", "Replacement Card", "Cancel Card"],
  access_level: ["Standard Access", "Manager Access", "Restricted Area Access"],
  card_type: ["iCLASS SEOS Clamshell", "iCLASS SEOS Keyfob", "Other"],
  card_format: ["H10301", "H10304", "H10306", "Corporate 1000", "Other"],
  delivery_method: ["Internal Mail", "Courier", "Pickup", "Urgent Pickup"]
};

const portalServices = [
  {
    id: "access-card",
    label: "Access Card Portal",
    helper: "Secure ordering",
    enabled: true
  },
  {
    id: "camera-ordering",
    label: "Camera Ordering",
    helper: "Coming soon",
    enabled: false
  },
  {
    id: "quote-request",
    label: "Quote Request",
    helper: "Coming soon",
    enabled: false
  },
  {
    id: "service-request",
    label: "Service Request",
    helper: "Not currently available",
    enabled: false
  }
];

const pageTitles: Record<Page, [string, string]> = {
  auth: ["SECURE ACCESS", "Welcome to BinaryGuard"],
  register: ["USER REGISTRATION", "User Registration"],
  otp: ["IDENTITY VERIFICATION", "Enter your security code"],
  services: ["CLIENT PORTAL", "Authorized Services"],
  checking: ["SERVICE AUTHORIZATION", "Checking access"],
  denied: ["SERVICE AUTHORIZATION", "Access denied"],
  order: ["SECURE ORDERING", "Access Card Ordering"],
  success: ["REQUEST CONFIRMATION", "Order submitted"]
};

const blankOrder = {
  request_type: "",
  cardholder_name: "",
  employee_id: "",
  department: "",
  job_title: "",
  cardholder_email: "",
  contact_number: "",
  site_name: "",
  building_address: "",
  floor: "",
  office_number: "",
  department_location: "",
  card_type: "",
  quantity: 1,
  access_level: "",
  card_format: "",
  replacement_reason: "",
  po_number: "",
  approved_by: "",
  delivery_address: "",
  receiving_person: "",
  delivery_phone: "",
  delivery_method: "",
  notes: ""
};

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join("") || "BG";
}

function reference() {
  return `ACO-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900000 + 100000))}`;
}

function getDisplayNameFromEmail(email: string) {
  const usernamePart = email.split("@")[0] || "Portal User";

  return usernamePart
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, character => character.toUpperCase()) || "Portal User";
}

function getOrgFromEmail(email: string) {
  const domain = email.split("@")[1]?.toLowerCase();

  if (domain === "binaryguard.ca") {
    return "BinaryGuard Innovations Inc.";
  }

  if (domain === "gov.mb.ca") {
    return "Manitoba Housing";
  }

  return "Manitoba Housing";
}

function extractDomainFromEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const parts = normalizedEmail.split("@");

  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return "";
  }

  return parts[1];
}

function getWinnipegGreeting() {
  const hourText = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Winnipeg",
    hour: "numeric",
    hour12: false
  }).format(new Date());

  const hour = Number(hourText);

  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 21) return "Good evening";
  return "Good night";
}

export default function App() {
  const [page, setPage] = useState<Page>("auth");
  const [servicesExpanded, setServicesExpanded] = useState(true);
  const [statusText, setStatusText] = useState("Not verified");
  const [statusOk, setStatusOk] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpExpiresAt, setOtpExpiresAt] = useState<number | null>(null);
  const [otpSecondsLeft, setOtpSecondsLeft] = useState(0);
  const [otpCode, setOtpCode] = useState("");
  const [otpPurpose, setOtpPurpose] = useState<"registration" | "login">("login");
  const otpInputRef = useRef<HTMLInputElement | null>(null);
  const otpAutoSubmitRef = useRef("");
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [user, setUser] = useState({ name: getDisplayNameFromEmail("john.smith@gov.mb.ca"), email: "john.smith@gov.mb.ca", org: getOrgFromEmail("john.smith@gov.mb.ca") });
  const [corporateEmail, setCorporateEmail] = useState("azeem.akram@binaryguard.ca");
  const [domainChecking, setDomainChecking] = useState(false);
  const [domainValid, setDomainValid] = useState(false);
  const [domainChecked, setDomainChecked] = useState(false);
  const [domainError, setDomainError] = useState("");
  const [registration, setRegistration] = useState({
    fullName: "",
    corporateEmail: "",
    organization: "Manitoba Housing",
    department: "",
    requestedRole: "standard_user",
    reason: ""
  });
  const [orderForm, setOrderForm] = useState(blankOrder);
  const [reviewConfirmed, setReviewConfirmed] = useState(false);

  const title = pageTitles[page];
  const steps = ["auth", "otp", "services", "order"];
  const activeStep = page === "checking" || page === "denied" ? "services" : page === "success" ? "order" : page;
  const activeStepIndex = Math.max(0, steps.indexOf(activeStep));

  function isStepEnabled(index: number) {
    if (page === "auth" || page === "register") return index === 0;
    if (page === "otp") return index === 1;
    if (page === "services" || page === "checking" || page === "denied") return index === 2;
    if (page === "order" || page === "success") return index === 2 || index === 3;
    return false;
  }

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
    const normalizedEmail = corporateEmail.trim().toLowerCase();
    const domain = extractDomainFromEmail(normalizedEmail);

    setDomainChecked(false);
    setDomainValid(false);
    setDomainError("");

    const emailLooksComplete =
      normalizedEmail.includes("@") &&
      domain.length >= 4 &&
      domain.includes(".") &&
      !domain.startsWith(".") &&
      !domain.endsWith(".");

    if (!emailLooksComplete) {
      setDomainChecking(false);
      return;
    }

    let cancelled = false;

    const validationTimer = window.setTimeout(async () => {
      setDomainChecking(true);

      try {
        const result = await validateApprovedDomain(domain);

        if (cancelled) return;

        setDomainChecked(true);
        setDomainValid(result.valid);

        if (!result.valid) {
          setDomainError(
            "Your domain is not registered. Please submit a request to admin."
          );
        }
      } catch (error) {
        if (cancelled) return;

        console.error("Domain validation failed:", error);
        setDomainChecked(true);
        setDomainValid(false);
        setDomainError(
          "Unable to validate your domain. Please try again."
        );
      } finally {
        if (!cancelled) {
          setDomainChecking(false);
        }
      }
    }, 700);

    return () => {
      cancelled = true;
      window.clearTimeout(validationTimer);
    };
  }, [corporateEmail]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const otpEmail = params.get("otp_email");
    const purposeParam = params.get("purpose");
    const normalizedPurpose = purposeParam === "registration" ? "registration" : purposeParam === "login" ? "login" : null;

    if (!otpEmail || !normalizedPurpose) return;

    const decodedEmail = decodeURIComponent(otpEmail).trim().toLowerCase();
    const matchedDomain = tenant.approvedEmailDomains.find(domain => decodedEmail.endsWith(domain));

    if (!decodedEmail.includes("@") || !matchedDomain) {
      toast("Invalid or unsupported OTP verification link.");
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    setCorporateEmail(decodedEmail);
    setUser({
      name: getDisplayNameFromEmail(decodedEmail),
      email: decodedEmail,
      org: getOrgFromEmail(decodedEmail),
    });
    setOtpPurpose(normalizedPurpose);
    setOtpCode("");
    setStatusText("OTP required");
    setStatusOk(false);
    startOtpTimer(10);
    showPage("otp");

    window.history.replaceState({}, document.title, window.location.pathname);
  }, []);

  useEffect(() => {
    if (page === "otp") {
      window.setTimeout(() => otpInputRef.current?.focus(), 150);
    }
  }, [page]);

  useEffect(() => {
    if (
      page !== "otp" ||
      otpCode.length !== 6 ||
      otpLoading ||
      otpSecondsLeft <= 0 ||
      otpAutoSubmitRef.current === otpCode
    ) {
      return;
    }

    otpAutoSubmitRef.current = otpCode;

    const submitTimer = window.setTimeout(() => {
      const form = document.getElementById("otp-verification-form") as HTMLFormElement | null;
      form?.requestSubmit();
    }, 0);

    return () => window.clearTimeout(submitTimer);
  }, [otpCode, page, otpLoading, otpSecondsLeft]);

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
    setToastMessage("");
    setOtpCode("");
    setOtpPurpose("login");
    setOtpExpiresAt(null);
    setOtpSecondsLeft(0);
    setDomainChecking(false);
    setDomainValid(false);
    setDomainChecked(false);
    setDomainError("");
    setEditingOrderId(null);
    setOrderForm(blankOrder);

    setCorporateEmail("");
    setUser({
      name: "Portal User",
      email: "",
      org: ""
    });
    window.history.replaceState({}, document.title, window.location.pathname);
    showPage("auth");
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const loginEmail = corporateEmail.trim().toLowerCase();
    const domain = extractDomainFromEmail(loginEmail);

    if (!loginEmail || !domain) {
      toast("Please enter a valid corporate email address.");
      return;
    }

    try {
      setDomainChecking(true);

      const domainResult = await validateApprovedDomain(domain);

      setDomainChecked(true);
      setDomainValid(domainResult.valid);

      if (!domainResult.valid) {
        setDomainError(
          "Your domain is not registered. Please submit a request to admin."
        );
        toast("This corporate domain is not registered.");
        return;
      }

      setDomainError("");

      setUser({
        name: getDisplayNameFromEmail(loginEmail),
        email: loginEmail,
        org: getOrgFromEmail(loginEmail)
      });

      setOtpLoading(true);
      setOtpPurpose("login");

      const result = await requestOtp(loginEmail, "login");

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
      toast(error instanceof Error ? error.message : "Unable to continue.");
    } finally {
      setDomainChecking(false);
      setOtpLoading(false);
    }
  }

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const email = registration.corporateEmail.trim().toLowerCase();

    if (!tenant.approvedEmailDomains.some(domain => email.endsWith(domain))) {
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
        name: registration.fullName || getDisplayNameFromEmail(email),
        email,
        org: registration.organization || getOrgFromEmail(email),
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

    if (otpCode.length !== 6 || otpLoading || otpSecondsLeft <= 0) {
      return;
    }

    try {
      setOtpLoading(true);
      const result = await verifyOtp(user.email, otpCode, otpPurpose);

      if (!result.ok) {
        otpAutoSubmitRef.current = "";
        setOtpCode("");
        toast(result.message || "Invalid OTP code.");
        window.setTimeout(() => otpInputRef.current?.focus(), 100);
        return;
      }

      setStatusText("Verified");
      setStatusOk(true);
      toast("OTP verified successfully.");
      showPage("services");
    } catch (error) {
      otpAutoSubmitRef.current = "";
      setOtpCode("");
      toast(error instanceof Error ? error.message : "Unable to verify OTP.");
      window.setTimeout(() => otpInputRef.current?.focus(), 100);
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
    setReviewConfirmed(false);
  }

  function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reviewConfirmed) {
      toast("Please review the order details and confirm before submitting.");
      return;
    }
    if (editingOrderId) {
      setOrders(current => current.map(order => order.id === editingOrderId ? { ...order, ...orderForm, quantity: Number(orderForm.quantity) } : order));
      resetOrder();
      toast("Request updated.");
      showPage("services");
      return;
    }
    const newOrder: Order = {
      id: crypto.randomUUID(),
      reference: reference(),
      submitted_at: new Date().toISOString(),
      ...orderForm,
      quantity: Number(orderForm.quantity),
      status: "Pending Review"
    };
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
      employee_id: found.employee_id,
      department: found.department,
      job_title: found.job_title,
      cardholder_email: found.cardholder_email,
      contact_number: found.contact_number,
      site_name: found.site_name,
      building_address: found.building_address,
      floor: found.floor,
      office_number: found.office_number,
      department_location: found.department_location,
      card_type: found.card_type,
      quantity: found.quantity,
      access_level: found.access_level,
      card_format: found.card_format,
      replacement_reason: found.replacement_reason,
      po_number: found.po_number,
      approved_by: found.approved_by,
      delivery_address: found.delivery_address,
      receiving_person: found.receiving_person,
      delivery_phone: found.delivery_phone,
      delivery_method: found.delivery_method,
      notes: found.notes
    });
    setReviewConfirmed(false);
    showPage("order");
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">BG</span><div><strong>BinaryGuard</strong><small>Secure Client Portal</small></div></div>
        <div className="secure-chip"><span></span> portal.binaryguard.ca</div>
        <nav className="journey" aria-label="Portal progress">
          <button
            className={`journey-step ${
              activeStepIndex === 0
                ? "active"
                : activeStepIndex > 0
                ? "done"
                : "locked"
            } ${!isStepEnabled(0) ? "disabled-step" : ""}`}
            onClick={() => isStepEnabled(0) && showPage("auth")}
            disabled={!isStepEnabled(0)}
            aria-disabled={!isStepEnabled(0)}
          >
            <i>{activeStepIndex > 0 ? "✓" : "1"}</i>
            <span>
              <b>User Authentication</b>
              <small>Login or registration request</small>
            </span>
          </button>

          <button
            className={`journey-step ${
              activeStepIndex === 1
                ? "active"
                : activeStepIndex > 1
                ? "done"
                : "locked"
            } ${!isStepEnabled(1) ? "disabled-step" : ""}`}
            onClick={() => isStepEnabled(1) && showPage("otp")}
            disabled={!isStepEnabled(1)}
            aria-disabled={!isStepEnabled(1)}
          >
            <i>{activeStepIndex > 1 ? "✓" : "2"}</i>
            <span>
              <b>OTP Verification</b>
              <small>One-time passcode</small>
            </span>
          </button>

          <div className="journey-service-group">
            <button
              type="button"
              className={`journey-step service-toggle ${
                activeStepIndex === 2
                  ? "active"
                  : activeStepIndex > 2
                  ? "done"
                  : "locked"
              } ${!isStepEnabled(2) ? "disabled-step" : ""}`}
              onClick={() => {
                if (isStepEnabled(2)) {
                  setServicesExpanded(current => !current);
                }
              }}
              disabled={!isStepEnabled(2)}
              aria-disabled={!isStepEnabled(2)}
              aria-expanded={servicesExpanded}
            >
              <i>{activeStepIndex > 2 ? "✓" : "3"}</i>
              <span>
                <b>Service Authorization</b>
                <small>Tenant & role access</small>
              </span>
              <span className={`service-chevron ${servicesExpanded ? "open" : ""}`}>
                ▾
              </span>
            </button>

            {servicesExpanded && isStepEnabled(2) && (
              <div className="service-submenu">
                {portalServices.map(service => {
                  const isActive =
                    service.id === "access-card" &&
                    (page === "order" || page === "success");

                  return (
                    <button
                      key={service.id}
                      type="button"
                      className={`service-submenu-item ${
                        isActive ? "active" : ""
                      } ${!service.enabled ? "disabled" : ""}`}
                      onClick={() => {
                        if (!service.enabled) {
                          toast(`${service.label} is not currently available.`);
                          return;
                        }

                        if (service.id === "access-card") {
                          openService();
                        }
                      }}
                      aria-disabled={!service.enabled}
                    >
                      <span className="service-submenu-icon">
                        {service.enabled ? "▣" : "○"}
                      </span>

                      <span>
                        <b>{service.label}</b>
                        <small>{service.helper}</small>
                      </span>

                      <span
                        className={`service-status ${
                          service.enabled ? "available" : "unavailable"
                        }`}
                      >
                        {service.enabled ? "Available" : "Coming soon"}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
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
          <div className="hero"><span className="hero-icon">→</span><div><p className="eyebrow">USER LOGIN</p><h2>User Login</h2><p>Use your approved organization email to enter the secure client portal.</p></div></div>
          <form className="card compact" onSubmit={login}>
            <label>
              Corporate email address
              <input
                type="email"
                value={corporateEmail}
                placeholder="user@company.ca"
                onChange={event => {
                  setCorporateEmail(event.target.value.trimStart().toLowerCase());
                }}
                autoComplete="email"
                className={`corporate-email-input ${
                  domainChecked
                    ? domainValid
                      ? "domain-approved"
                      : "domain-rejected"
                    : ""
                }`}
                required
              />

              <div
                className={`domain-validation ${
                  domainChecking
                    ? "checking"
                    : domainValid
                      ? "valid"
                      : domainChecked
                        ? "invalid"
                        : ""
                }`}
                aria-live="polite"
              >
                {domainChecking && (
                  <p><span className="domain-spinner" />Checking corporate domain...</p>
                )}
                {!domainChecking && domainChecked && domainValid && (
                  <p className="domain-success">✓ This corporate domain is approved.</p>
                )}
                {!domainChecking && domainChecked && !domainValid && (
                  <p className="domain-error">
                    Your domain is not registered. Please submit a request to admin via{" "}
                    <a className="domain-contact-link" href="https://binaryguard.ca/contact" target="_blank" rel="noreferrer">Contact Us</a>.
                  </p>
                )}
              </div>
            </label>
            <button
              className="primary"
              type="submit"
              disabled={otpLoading || domainChecking || !domainChecked || !domainValid || !corporateEmail.trim()}
            >
              {domainChecking ? "Checking domain..." : otpLoading ? "Sending OTP..." : "Continue"} <span>→</span>
            </button>
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
                <select
                  value={registration.organization}
                  onChange={e => setRegistration({ ...registration, organization: e.target.value })}
                  required
                >
                  {organizationOptions.map(organization => (
                    <option key={organization} value={organization}>{organization}</option>
                  ))}
                </select>
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
          <div className="hero"><span className="hero-icon">••</span><div><p className="eyebrow">OTP VERIFICATION</p><h2>Verify your identity</h2><p>We sent a six-digit code to <b>{user.email}</b>. It expires in 10 minutes.</p></div></div>
          <form id="otp-verification-form" className="card compact" onSubmit={verify}>
            <label>
              Verification code
              <input
                ref={otpInputRef}
                value={otpCode}
                onChange={event => {
                  const value = event.target.value.replace(/\D/g, "").slice(0, 6);
                  setOtpCode(value);

                  if (value.length < 6) {
                    otpAutoSubmitRef.current = "";
                  }
                }}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                disabled={otpLoading}
                autoFocus
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
          <div className="hero"><span className="hero-icon">⌘</span><div><p className="eyebrow">AUTHORIZED SERVICES</p><h2>{getWinnipegGreeting()}, {user.name.split(" ")[0]}</h2><p>Select a service available to <span>{user.org}</span>.</p></div></div>
          <div className="service-grid"><article className="service-card featured"><div className="service-top"><span className="service-icon">▣</span><span className="approved">Enabled</span></div><h3>Access Card Ordering</h3><p>Request new, replacement, or cancellation of access cards for your organization.</p><button className="primary" onClick={openService}>Open Access Card Ordering <span>→</span></button></article><article className="service-card muted"><div className="service-top"><span className="service-icon">◉</span><span className="soon">Coming soon</span></div><h3>Camera Ordering</h3><p>Order security camera equipment and supporting services.</p></article><article className="service-card muted"><div className="service-top"><span className="service-icon">◇</span><span className="soon">Coming soon</span></div><h3>Quote Requests</h3><p>Request a tailored quote from the BinaryGuard team.</p></article></div>
          <section className="client-dashboard"><div className="dashboard-heading"><div><p className="eyebrow">MY ORDERS</p><h2>Submitted access card requests</h2><p>Review order status, submission date, quantity, and available actions.</p></div><button className="secondary" type="button">Refresh</button></div><div className="client-summary"><article><b>{summary.total}</b><span>Total submitted</span></article><article><b>{summary.active}</b><span>Active requests</span></article><article><b>{summary.completed}</b><span>Completed</span></article></div><div className="client-request-list">{orders.length === 0 ? <article className="empty-state"><h3>No submitted requests yet</h3><p>Use Access Card Ordering to create your first request.</p></article> : <div className="table-wrap"><table><thead><tr><th>Order</th><th>Status</th><th>Submitted</th><th>Quantity</th><th>Action</th></tr></thead><tbody>{orders.map(order => <tr key={order.id}><td>{order.reference}</td><td><span className="pill">{order.status}</span></td><td>{new Date(order.submitted_at).toLocaleDateString("en-CA")}</td><td>{order.quantity}</td><td className="row-actions"><button className="secondary small" onClick={() => toast(`${order.reference}: ${order.status}`)}>View</button>{order.status === "Pending Review" && <button className="secondary small" onClick={() => editOrder(order.id)}>Edit</button>}{order.status === "Pending Review" && <button className="danger small" onClick={() => setOrders(current => current.filter(item => item.id !== order.id))}>Cancel</button>}</td></tr>)}</tbody></table></div>}</div></section>
        </section>

        <section className={`page ${page === "checking" ? "active" : ""}`}><div className="gate-card"><div className="spinner"></div><p className="eyebrow">SECURE CHECK</p><h2>Verifying service authorization</h2><p>We’re confirming your account activation, organization, service access, and role before loading the order form.</p><ul><li className="checked">Authenticated user</li><li className="checked">Activated user account</li><li className="checked">Active tenant</li><li className="checked">Access Card Ordering enabled</li><li className="checked">Authorized user role</li></ul></div></section>
        <section className={`page ${page === "denied" ? "active" : ""}`}><div className="gate-card denied"><span className="denied-icon">!</span><p className="eyebrow">ACCESS DENIED</p><h2>You are not authorized</h2><p>You are not authorized to use the Access Card Ordering service.</p><button className="secondary" onClick={() => showPage("services")}>Return to services</button></div></section>

        <section className={`page ${page === "order" ? "active" : ""}`}>
          <div className="order-heading"><div><p className="eyebrow">ACCESS CARD ORDERING</p><h2>{editingOrderId ? "Edit access card request" : "New access card request"}</h2><p>Complete the required details, review the order, and confirm before submitting.</p></div><span className="draft">{editingOrderId ? "Edit mode" : "Secure form"}</span></div>
          <form onSubmit={submitOrder}>
            <section className="form-section"><div className="section-title"><span>01</span><div><h3>Requester information</h3><p>Automatically populated after OTP authentication</p></div><b className="readonly-pill">Read only</b></div><div className="identity-grid"><div><small>Verified corporate email</small><strong>{user.email}</strong></div><div><small>Organization</small><strong>{user.org}</strong></div><div><small>Request submitted by</small><strong>{user.name}</strong></div><div><small>Submission date</small><strong>{new Date().toLocaleDateString("en-CA")}</strong></div><div><small>Order ID</small><strong>{editingOrderId ? orders.find(order => order.id === editingOrderId)?.reference : "Generated after submission"}</strong></div></div></section>
            <section className="form-section"><div className="section-title"><span>02</span><div><h3>Request type</h3><p>Select the required access card action</p></div></div><div className="form-grid"><label>Request type *<select value={orderForm.request_type} onChange={e => setOrderForm({ ...orderForm, request_type: e.target.value })} required><option value="">Select an option</option>{dropdownOptions.request_type.map(x => <option key={x}>{x}</option>)}</select></label></div></section>
            <section className="form-section"><div className="section-title"><span>03</span><div><h3>Cardholder information</h3><p>Information about the person who will receive or use the card</p></div></div><div className="form-grid"><label>Cardholder full name *<input value={orderForm.cardholder_name} onChange={e => setOrderForm({ ...orderForm, cardholder_name: e.target.value })} required /></label><label>Employee ID <span className="optional">optional</span><input value={orderForm.employee_id} onChange={e => setOrderForm({ ...orderForm, employee_id: e.target.value })} /></label><label>Department *<input value={orderForm.department} onChange={e => setOrderForm({ ...orderForm, department: e.target.value })} required /></label><label>Job title *<input value={orderForm.job_title} onChange={e => setOrderForm({ ...orderForm, job_title: e.target.value })} required /></label><label>Corporate email *<input type="email" value={orderForm.cardholder_email} onChange={e => setOrderForm({ ...orderForm, cardholder_email: e.target.value })} required /></label><label>Contact number *<input type="tel" value={orderForm.contact_number} onChange={e => setOrderForm({ ...orderForm, contact_number: e.target.value })} required /></label></div></section>
            <section className="form-section"><div className="section-title"><span>04</span><div><h3>Site information</h3><p>Identify the cardholder location and destination</p></div></div><div className="form-grid"><label>Site name *<input value={orderForm.site_name} onChange={e => setOrderForm({ ...orderForm, site_name: e.target.value })} required /></label><label>Building *<input value={orderForm.building_address} onChange={e => setOrderForm({ ...orderForm, building_address: e.target.value })} required /></label><label>Floor<input value={orderForm.floor} onChange={e => setOrderForm({ ...orderForm, floor: e.target.value })} /></label><label>Office number<input value={orderForm.office_number} onChange={e => setOrderForm({ ...orderForm, office_number: e.target.value })} /></label><label>Department location<input value={orderForm.department_location} onChange={e => setOrderForm({ ...orderForm, department_location: e.target.value })} /></label></div></section>
            <section className="form-section"><div className="section-title"><span>05</span><div><h3>Card information</h3><p>Specify product, quantity, format, and access requirements</p></div></div><div className="form-grid"><label>Card type *<select value={orderForm.card_type} onChange={e => setOrderForm({ ...orderForm, card_type: e.target.value })} required><option value="">Select an option</option>{dropdownOptions.card_type.map(x => <option key={x}>{x}</option>)}</select></label><label>Quantity *<input type="number" min="1" max="10000" value={orderForm.quantity} onChange={e => setOrderForm({ ...orderForm, quantity: Number(e.target.value) })} required /></label><label>Access level *<select value={orderForm.access_level} onChange={e => setOrderForm({ ...orderForm, access_level: e.target.value })} required><option value="">Select an option</option>{dropdownOptions.access_level.map(x => <option key={x}>{x}</option>)}</select></label><label>Card format *<select value={orderForm.card_format} onChange={e => setOrderForm({ ...orderForm, card_format: e.target.value })} required><option value="">Select an option</option>{dropdownOptions.card_format.map(x => <option key={x}>{x}</option>)}</select></label><label>New / replacement reason<input value={orderForm.replacement_reason} onChange={e => setOrderForm({ ...orderForm, replacement_reason: e.target.value })} /></label></div></section>
            <section className="form-section"><div className="section-title"><span>06</span><div><h3>Purchase information</h3><p>Client-provided purchase order and approval details</p></div></div><div className="form-grid"><label>PO Number *<input value={orderForm.po_number} onChange={e => setOrderForm({ ...orderForm, po_number: e.target.value })} placeholder="Enter the purchase order number issued by your organization" required /></label><label>Approved By<input value={orderForm.approved_by} onChange={e => setOrderForm({ ...orderForm, approved_by: e.target.value })} /></label></div></section>
            <section className="form-section"><div className="section-title"><span>07</span><div><h3>Delivery information</h3><p>Tell us where and how the order should be delivered</p></div></div><div className="form-grid"><label>Delivery address *<textarea value={orderForm.delivery_address} onChange={e => setOrderForm({ ...orderForm, delivery_address: e.target.value })} required /></label><label>Receiving person *<input value={orderForm.receiving_person} onChange={e => setOrderForm({ ...orderForm, receiving_person: e.target.value })} required /></label><label>Phone number *<input type="tel" value={orderForm.delivery_phone} onChange={e => setOrderForm({ ...orderForm, delivery_phone: e.target.value })} required /></label><label>Preferred delivery method *<select value={orderForm.delivery_method} onChange={e => setOrderForm({ ...orderForm, delivery_method: e.target.value })} required><option value="">Select an option</option>{dropdownOptions.delivery_method.map(x => <option key={x}>{x}</option>)}</select></label></div></section>
            <section className="form-section"><div className="section-title"><span>08</span><div><h3>Additional notes</h3><p>Add any special instructions or supporting context</p></div></div><label>Notes / remarks<textarea value={orderForm.notes} onChange={e => setOrderForm({ ...orderForm, notes: e.target.value })} placeholder="Example: Please activate after July 15." /></label></section>
            <section className="form-section"><div className="section-title"><span>09</span><div><h3>Order review</h3><p>Review the order summary before submitting</p></div></div><div className="identity-grid"><div><small>Requester</small><strong>{user.name}</strong></div><div><small>Verified email</small><strong>{user.email}</strong></div><div><small>Cardholder</small><strong>{orderForm.cardholder_name || "Not entered"}</strong></div><div><small>Site</small><strong>{orderForm.site_name || "Not entered"}</strong></div><div><small>PO Number</small><strong>{orderForm.po_number || "Not entered"}</strong></div><div><small>Quantity</small><strong>{orderForm.quantity}</strong></div><div><small>Delivery address</small><strong>{orderForm.delivery_address || "Not entered"}</strong></div><div><small>Notes</small><strong>{orderForm.notes || "No additional notes"}</strong></div></div><label className="check-row"><input type="checkbox" checked={reviewConfirmed} onChange={e => setReviewConfirmed(e.target.checked)} />I have reviewed the order information and confirm that the details are correct.</label></section>
            <div className="form-actions"><p><span>✓</span> The order will be assigned an Order ID and submitted with status Pending Review.</p><div className="form-action-buttons"><button className="secondary" type="button" onClick={() => showPage("services")}>Back to services</button><button className="primary" type="submit" disabled={!reviewConfirmed}>{editingOrderId ? "Save changes" : "Submit access card order"} <span>→</span></button></div></div>
          </form>
        </section>

        <section className={`page ${page === "success" ? "active" : ""}`}><div className="success-card"><span className="success-icon">✓</span><p className="eyebrow">NEW ACCESS CARD REQUEST SUBMITTED</p><h2>Your access card request has been received</h2><p>A confirmation summary will be sent to <b>{user.email}</b>.</p>{orders[0] && <div className="reference"><small>ORDER ID</small><strong>{orders[0].reference}</strong><span>{orders[0].status}</span></div>}{orders[0] && <div className="identity-grid"><div><small>Submitted By</small><strong>{user.email}</strong></div><div><small>Organization</small><strong>{user.org}</strong></div><div><small>Cardholder</small><strong>{orders[0].cardholder_name}</strong></div><div><small>Department</small><strong>{orders[0].department}</strong></div><div><small>Request Type</small><strong>{orders[0].request_type}</strong></div><div><small>Card Type</small><strong>{orders[0].card_type}</strong></div><div><small>Quantity</small><strong>{orders[0].quantity}</strong></div><div><small>PO Number</small><strong>{orders[0].po_number}</strong></div><div><small>Delivery</small><strong>{orders[0].delivery_address}</strong></div><div><small>Attention</small><strong>{orders[0].receiving_person}</strong></div></div>}<div className="success-actions"><button className="primary" onClick={() => showPage("services")}>View my orders</button><button className="secondary" onClick={signOut}>Sign out</button></div></div></section>
        <div className={`toast ${toastMessage ? "show" : ""}`}>{toastMessage}</div>
      </main>
    </div>
  );
}
