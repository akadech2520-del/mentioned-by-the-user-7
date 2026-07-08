const KEYS = {
  personnel: "gpk16.personnel.v1",
  requests: "gpk16.requests.v1",
  settings: "gpk16.settings.v1",
  reuse: "gpk16.reuse.v1",
  session: "gpk16.session.v1"
};

const MAX_PDF_BYTES = 3 * 1024 * 1024;
const MAX_SIGNATURE_BYTES = 1.5 * 1024 * 1024;

const seedPersonnel = [
  {
    payId: "1001",
    dob: "01012530",
    name: "นายสมชาย ใจดี",
    position: "ครู คศ.1",
    school: "โรงเรียนบ้านนา",
    district: "สว่างแดนดิน"
  },
  {
    payId: "1002",
    dob: "15052528",
    name: "นางสาวสมหญิง งามตา",
    position: "ครู คศ.2",
    school: "โรงเรียนสกลศึกษา",
    district: "เมืองสกลนคร"
  },
  {
    payId: "1003",
    dob: "07072529",
    name: "นายกิตติพงศ์ รักษ์เรียน",
    position: "ครูผู้ช่วย",
    school: "โรงเรียนบ้านโนนสะอาด",
    district: "พังโคน"
  }
];

const defaultSettings = {
  certifierName: "",
  certifierPosition: "ผู้อำนวยการกลุ่มบริหารงานบุคคล",
  office: "สำนักงานเขตพื้นที่การศึกษาประถมศึกษาสกลนคร เขต 2",
  signatureDataUrl: "",
  updatedAt: ""
};

const app = document.getElementById("app");

let state = {
  currentUser: loadJson(KEYS.session, null),
  loginRole: "user",
  personnel: loadJson(KEYS.personnel, seedPersonnel),
  requests: loadJson(KEYS.requests, createSeedRequests),
  settings: loadJson(KEYS.settings, defaultSettings),
  reuse: loadJson(KEYS.reuse, {}),
  activeSendId: null,
  toast: null
};

render();

document.addEventListener("click", async (event) => {
  const target = event.target.closest("[data-action], [data-login-role]");
  if (!target) return;

  const loginRole = target.dataset.loginRole;
  if (loginRole) {
    state.loginRole = loginRole;
    render();
    return;
  }

  const action = target.dataset.action;
  if (action === "logout") {
    state.currentUser = null;
    sessionStorage.removeItem(KEYS.session);
    showToast("ออกจากระบบแล้ว", "info");
    render();
  }

  if (action === "open-send") {
    state.activeSendId = target.dataset.id;
    render();
  }

  if (action === "close-modal") {
    state.activeSendId = null;
    render();
  }

  if (action === "print-certified") {
    const request = findRequest(target.dataset.id);
    if (request) printCertifiedCopy(request);
  }

  if (action === "reset-demo") {
    const confirmed = window.confirm("ต้องการล้างข้อมูลในเครื่องและเริ่มต้นข้อมูลตัวอย่างใหม่หรือไม่");
    if (!confirmed) return;
    localStorage.removeItem(KEYS.personnel);
    localStorage.removeItem(KEYS.requests);
    localStorage.removeItem(KEYS.settings);
    localStorage.removeItem(KEYS.reuse);
    sessionStorage.removeItem(KEYS.session);
    state = {
      currentUser: null,
      loginRole: "user",
      personnel: seedPersonnel,
      requests: createSeedRequests(),
      settings: defaultSettings,
      reuse: {},
      activeSendId: null,
      toast: null
    };
    showToast("เริ่มต้นข้อมูลตัวอย่างใหม่เรียบร้อย", "success");
    render();
  }
});

document.addEventListener("submit", async (event) => {
  const form = event.target;

  if (form.id === "loginForm") {
    event.preventDefault();
    handleLogin(form);
  }

  if (form.id === "requestForm") {
    event.preventDefault();
    handleCreateRequest(form);
  }

  if (form.id === "sendForm") {
    event.preventDefault();
    await handleSendPdf(form);
  }

  if (form.id === "adminSettingsForm") {
    event.preventDefault();
    await handleSaveSettings(form);
  }

  if (form.id === "personnelForm") {
    event.preventDefault();
    handleSavePersonnel(form);
  }
});

document.addEventListener("change", async (event) => {
  if (event.target.id === "signatureFile") {
    const file = event.target.files?.[0];
    const preview = document.getElementById("signaturePreview");
    if (!file || !preview) return;
    if (!file.type.startsWith("image/")) {
      showToast("กรุณาเลือกไฟล์รูปภาพลายมือชื่อ", "error");
      event.target.value = "";
      return;
    }
    if (file.size > MAX_SIGNATURE_BYTES) {
      showToast("ไฟล์ลายมือชื่อต้องไม่เกิน 1.5 MB", "error");
      event.target.value = "";
      return;
    }
    const dataUrl = await fileToDataUrl(file);
    preview.innerHTML = `<img src="${dataUrl}" alt="ตัวอย่างลายมือชื่อ">`;
  }
});

function render() {
  app.innerHTML = `
    <div class="app-shell">
      ${renderHeader()}
      <main class="page">
        ${state.currentUser ? renderDashboard() : renderLogin()}
      </main>
      ${state.toast ? `<div class="toast ${state.toast.type}">${h(state.toast.message)}</div>` : ""}
      ${state.activeSendId ? renderSendModal(findRequest(state.activeSendId)) : ""}
    </div>
  `;
}

function renderHeader() {
  return `
    <header class="topbar">
      <div class="topbar-inner">
        <div class="brand">
          <div class="brand-mark">ก.ค.ศ.</div>
          <div>
            <h1>ระบบการขอ ก.พ.7 / ก.ค.ศ.16 ONLINE</h1>
            <p>กลุ่มบริหารงานบุคคล · รองรับการส่งเอกสาร PDF และสำเนาถูกต้อง</p>
          </div>
        </div>
        ${
          state.currentUser
            ? `<div class="user-chip">
                <div>
                  <strong>${h(state.currentUser.name)}</strong>
                  <span>${roleLabel(state.currentUser.role)}</span>
                </div>
                <button class="btn danger" type="button" data-action="logout">ออกจากระบบ</button>
              </div>`
            : ""
        }
      </div>
    </header>
  `;
}

function renderLogin() {
  const role = state.loginRole;
  const usernameLabel = role === "user" ? "เลขที่จ่ายตรง" : "ชื่อผู้ใช้งาน";
  const passwordLabel = role === "user" ? "รหัสผ่าน (วันเดือนปีเกิด)" : "รหัสผ่าน";
  const usernameHint =
    role === "user"
      ? "ข้อมูลทดสอบ: 1001 / 01012530 หรือ 1002 / 15052528"
      : role === "staff"
        ? "ข้อมูลทดสอบเจ้าหน้าที่: 1234 / 1234567890"
        : "ข้อมูลทดสอบแอดมิน: admin / 1234567890";

  return `
    <div class="login-wrap">
      <section class="panel login-card">
        <div class="login-head">
          <div class="brand-mark">ก.ค.ศ.</div>
          <h2>เข้าสู่ระบบ</h2>
          <p>เลือกสิทธิ์การใช้งานแล้วกรอกข้อมูลเพื่อเริ่มทำรายการ</p>
        </div>
        <div class="login-body">
          <div class="segmented" aria-label="เลือกสิทธิ์">
            <button class="segment ${role === "user" ? "active" : ""}" type="button" data-login-role="user">ผู้ขอ</button>
            <button class="segment ${role === "staff" ? "active" : ""}" type="button" data-login-role="staff">เจ้าหน้าที่</button>
            <button class="segment ${role === "admin" ? "active" : ""}" type="button" data-login-role="admin">แอดมิน</button>
          </div>
          <form id="loginForm">
            <div class="field">
              <label for="username">${usernameLabel}</label>
              <input id="username" name="username" type="text" autocomplete="username" required>
              <p class="hint">${usernameHint}</p>
            </div>
            <div class="field">
              <label for="password">${passwordLabel}</label>
              <input id="password" name="password" type="password" autocomplete="current-password" required>
            </div>
            <button class="btn primary" type="submit">เข้าสู่ระบบ</button>
          </form>
        </div>
      </section>
    </div>
  `;
}

function renderDashboard() {
  if (state.currentUser.role === "admin") return renderAdminDashboard();
  if (state.currentUser.role === "staff") return renderStaffDashboard();
  return renderUserDashboard();
}

function renderUserDashboard() {
  const user = state.currentUser;
  const myRequests = state.requests.filter((request) => request.payId === user.payId);
  const reuse = state.reuse[user.payId] || {};
  const hasReuse = Boolean(reuse.updatedAt);
  const pending = myRequests.filter((request) => !isCompleted(request)).length;
  const completed = myRequests.filter(isCompleted).length;

  return `
    <div class="dashboard-head">
      <div>
        <h2>ยื่นคำขอเอกสาร</h2>
        <p>ระบบจะเก็บข้อมูลคำขอไว้ เพื่อกรอกซ้ำให้อัตโนมัติเมื่อมีการขอครั้งถัดไป</p>
      </div>
    </div>

    <div class="grid three">
      <div class="stat"><span>คำขอทั้งหมดของคุณ</span><strong>${myRequests.length}</strong></div>
      <div class="stat"><span>รอดำเนินการ</span><strong>${pending}</strong></div>
      <div class="stat"><span>ส่งเอกสารแล้ว</span><strong>${completed}</strong></div>
    </div>

    <div class="grid two" style="margin-top:16px">
      <section class="panel panel-pad">
        <h3 class="section-title">ข้อมูลผู้ขอ</h3>
        ${renderProfile(user)}
        <h3 class="section-title">ยื่นคำขอใหม่</h3>
        ${hasReuse ? `<p class="reuse-note">พบข้อมูลจากคำขอครั้งก่อน ระบบกรอกประเภทการขอ เบอร์โทร และหมายเหตุเดิมให้แล้ว</p>` : ""}
        ${renderRequestForm(user, reuse)}
      </section>
      <section class="panel panel-pad">
        <h3 class="section-title">ประวัติคำขอ <small>${myRequests.length} รายการ</small></h3>
        ${renderRequestTable(myRequests, "user")}
      </section>
    </div>
  `;
}

function renderStaffDashboard() {
  const pending = state.requests.filter((request) => !isCompleted(request));
  const completed = state.requests.filter(isCompleted);
  const settingsReady = Boolean(state.settings.certifierName && state.settings.signatureDataUrl);

  return `
    <div class="dashboard-head">
      <div>
        <h2>จัดการและส่งเอกสาร PDF</h2>
        <p>อัปโหลดไฟล์ PDF ให้ผู้ขอ แล้วระบบจะบันทึกสำเนาถูกต้องพร้อมลายมือชื่อผู้รับรอง</p>
      </div>
    </div>

    ${settingsReady
      ? `<p class="ok-note">ผู้รับรองปัจจุบัน: ${h(state.settings.certifierName)} · ${h(state.settings.certifierPosition)}</p>`
      : `<p class="warning-note">ยังไม่ครบข้อมูลผู้รับรอง กรุณาให้แอดมินระบุชื่อ-สกุลผู้รับรองและอัปโหลดลายมือชื่อก่อนส่งเอกสาร</p>`
    }

    <div class="grid three">
      <div class="stat"><span>คำขอทั้งหมด</span><strong>${state.requests.length}</strong></div>
      <div class="stat"><span>รอส่ง PDF</span><strong>${pending.length}</strong></div>
      <div class="stat"><span>ส่งแล้ว</span><strong>${completed.length}</strong></div>
    </div>

    <section class="panel panel-pad" style="margin-top:16px">
      <div class="toolbar">
        <h3 class="section-title">คำขอรอดำเนินการ <small>${pending.length} รายการ</small></h3>
      </div>
      ${renderRequestTable(pending, "staffPending")}
    </section>

    <section class="panel panel-pad" style="margin-top:16px">
      <h3 class="section-title">รายการที่ส่งเอกสารแล้ว <small>${completed.length} รายการ</small></h3>
      ${renderRequestTable(completed, "staffCompleted")}
    </section>
  `;
}

function renderAdminDashboard() {
  return `
    <div class="dashboard-head">
      <div>
        <h2>หน้าแอดมิน</h2>
        <p>กำหนดชื่อ-สกุลผู้รับรอง อัปโหลดลายมือชื่อ และดูข้อมูลคำขอทั้งหมด</p>
      </div>
      <button class="btn ghost" type="button" data-action="reset-demo">เริ่มข้อมูลตัวอย่างใหม่</button>
    </div>

    <div class="grid two">
      <section class="panel panel-pad">
        <h3 class="section-title">ข้อมูลผู้รับรองสำเนาถูกต้อง</h3>
        <form id="adminSettingsForm">
          <div class="field">
            <label for="certifierName">ชื่อ-สกุลผู้รับรอง</label>
            <input id="certifierName" name="certifierName" type="text" value="${attr(state.settings.certifierName)}" placeholder="เช่น นาย/นาง/นางสาว..." required>
          </div>
          <div class="field">
            <label for="certifierPosition">ตำแหน่งผู้รับรอง</label>
            <input id="certifierPosition" name="certifierPosition" type="text" value="${attr(state.settings.certifierPosition)}" required>
          </div>
          <div class="field">
            <label for="office">หน่วยงาน</label>
            <input id="office" name="office" type="text" value="${attr(state.settings.office)}" required>
          </div>
          <div class="field">
            <label for="signatureFile">อัปโหลดลายมือชื่อ</label>
            <input id="signatureFile" name="signatureFile" type="file" accept="image/png,image/jpeg,image/webp">
            <p class="hint">รองรับ PNG, JPG, WebP ขนาดไม่เกิน 1.5 MB</p>
          </div>
          <div class="cert-preview">
            <h4>ตัวอย่างลายมือชื่อในระบบ</h4>
            <div id="signaturePreview" class="signature-box">
              ${state.settings.signatureDataUrl
                ? `<img src="${state.settings.signatureDataUrl}" alt="ลายมือชื่อผู้รับรอง">`
                : `<div class="signature-placeholder">ยังไม่ได้อัปโหลด</div>`
              }
              <strong>${state.settings.certifierName ? h(state.settings.certifierName) : "ยังไม่ได้ระบุชื่อผู้รับรอง"}</strong>
              <span>${h(state.settings.certifierPosition)}</span>
            </div>
          </div>
          <div class="actions end" style="margin-top:16px">
            <button class="btn primary" type="submit">บันทึกข้อมูลผู้รับรอง</button>
          </div>
        </form>
      </section>

      <section class="panel panel-pad">
        <h3 class="section-title">เพิ่ม/ปรับปรุงข้อมูลบุคลากร</h3>
        <form id="personnelForm">
          <div class="grid two">
            <div class="field">
              <label for="payId">เลขที่จ่ายตรง</label>
              <input id="payId" name="payId" type="text" required>
            </div>
            <div class="field">
              <label for="dob">วันเดือนปีเกิด</label>
              <input id="dob" name="dob" type="text" placeholder="เช่น 01012530" required>
            </div>
          </div>
          <div class="field">
            <label for="name">ชื่อ-สกุล</label>
            <input id="name" name="name" type="text" required>
          </div>
          <div class="grid two">
            <div class="field">
              <label for="position">ตำแหน่ง</label>
              <input id="position" name="position" type="text" required>
            </div>
            <div class="field">
              <label for="district">อำเภอ</label>
              <input id="district" name="district" type="text" required>
            </div>
          </div>
          <div class="field">
            <label for="school">สถานศึกษา</label>
            <input id="school" name="school" type="text" required>
          </div>
          <div class="actions end">
            <button class="btn soft" type="submit">บันทึกบุคลากร</button>
          </div>
        </form>
      </section>
    </div>

    <section class="panel panel-pad" style="margin-top:16px">
      <h3 class="section-title">คำขอทั้งหมด <small>${state.requests.length} รายการ</small></h3>
      ${renderRequestTable(state.requests, "admin")}
    </section>

    <section class="panel panel-pad" style="margin-top:16px">
      <h3 class="section-title">ข้อมูลบุคลากรในระบบ <small>${state.personnel.length} คน</small></h3>
      ${renderPersonnelTable()}
    </section>
  `;
}

function renderProfile(user) {
  return `
    <dl class="profile-list">
      <div><dt>ชื่อ-สกุล</dt><dd>${h(user.name)}</dd></div>
      <div><dt>เลขที่จ่ายตรง</dt><dd>${h(user.payId)}</dd></div>
      <div><dt>ตำแหน่ง</dt><dd>${h(user.position)}</dd></div>
      <div><dt>สถานศึกษา</dt><dd>${h(user.school)}</dd></div>
      <div><dt>อำเภอ</dt><dd>${h(user.district)}</dd></div>
      <div><dt>วันเดือนปีเกิด</dt><dd>${h(user.dob)}</dd></div>
    </dl>
  `;
}

function renderRequestForm(user, reuse) {
  const defaultDate = nextDateInput(7);
  return `
    <form id="requestForm">
      <div class="grid two">
        <div class="field">
          <label for="requestType">ประเภทการขอ</label>
          <select id="requestType" name="type" required>
            <option value="ปกติ" ${reuse.type === "ปกติ" ? "selected" : ""}>ปกติ</option>
            <option value="กรณีพิเศษ" ${reuse.type === "กรณีพิเศษ" ? "selected" : ""}>กรณีพิเศษ</option>
          </select>
        </div>
        <div class="field">
          <label for="appointDate">วันที่นัดรับ / วันที่ต้องการเอกสาร</label>
          <input id="appointDate" name="appointDate" type="date" value="${attr(defaultDate)}" required>
        </div>
      </div>
      <div class="field">
        <label for="contactPhone">เบอร์โทรติดต่อ</label>
        <input id="contactPhone" name="contactPhone" type="tel" value="${attr(reuse.contactPhone || "")}" placeholder="เช่น 08x-xxx-xxxx" required>
      </div>
      <div class="field">
        <label for="reason">เหตุผล/ความจำเป็น</label>
        <textarea id="reason" name="reason" placeholder="ระบุเหตุผล โดยเฉพาะกรณีพิเศษ">${h(reuse.reason || "")}</textarea>
      </div>
      <div class="field">
        <label for="note">หมายเหตุเพิ่มเติม</label>
        <textarea id="note" name="note" placeholder="รายละเอียดอื่น ๆ สำหรับเจ้าหน้าที่">${h(reuse.note || "")}</textarea>
      </div>
      <div class="actions end">
        <button class="btn primary" type="submit">ส่งคำขอ</button>
      </div>
    </form>
  `;
}

function renderRequestTable(requests, mode) {
  if (!requests.length) return `<div class="empty">ยังไม่มีรายการ</div>`;

  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>ผู้ขอ</th>
            <th>ประเภท/วันที่ขอ</th>
            <th>สถานะ</th>
            <th>เอกสาร</th>
          </tr>
        </thead>
        <tbody>
          ${requests.map((request) => renderRequestRow(request, mode)).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderRequestRow(request, mode) {
  const completed = isCompleted(request);
  const pdf = request.delivery?.pdf;
  const certified = request.certification;
  const sendButton = mode === "staffPending"
    ? `<button class="btn primary" type="button" data-action="open-send" data-id="${attr(request.id)}">ส่ง PDF</button>`
    : "";
  const pdfLink = pdf?.dataUrl
    ? `<a class="btn ghost" href="${pdf.dataUrl}" download="${attr(pdf.name)}">ดาวน์โหลด PDF</a>`
    : "";
  const certButton = certified
    ? `<button class="btn soft" type="button" data-action="print-certified" data-id="${attr(request.id)}">ใบรับรองสำเนาถูกต้อง</button>`
    : "";
  const documentCell = [sendButton, pdfLink, certButton].filter(Boolean).join(" ");

  return `
    <tr>
      <td>
        <div class="person-name">${h(request.name)}</div>
        <div class="meta">${h(request.position)} · ${h(request.school)} · อ.${h(request.district)}</div>
        <div class="meta">จ่ายตรง: ${h(request.payId)} · เกิด: ${h(request.dob)} · โทร: ${h(request.contactPhone || "-")}</div>
      </td>
      <td>
        <span class="badge info">${h(request.type)}</span>
        <div class="meta">ยื่น: ${formatThaiDate(request.requestDate)}</div>
        <div class="meta">ต้องการเอกสาร: ${formatThaiDate(request.appointDate)}</div>
      </td>
      <td>
        <span class="badge ${completed ? "done" : "pending"}">${h(request.status)}</span>
        ${request.sentAt ? `<div class="meta">ส่งเมื่อ: ${formatThaiDateTime(request.sentAt)}</div>` : ""}
      </td>
      <td>
        <div class="actions">${documentCell || `<span class="meta">ยังไม่มีไฟล์ PDF</span>`}</div>
        ${pdf ? `<div class="meta">ไฟล์: ${h(pdf.name)} (${formatBytes(pdf.size)})</div>` : ""}
      </td>
    </tr>
  `;
}

function renderPersonnelTable() {
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>เลขที่จ่ายตรง</th>
            <th>วันเดือนปีเกิด</th>
            <th>ชื่อ-สกุล</th>
            <th>ตำแหน่ง</th>
            <th>สถานศึกษา/อำเภอ</th>
          </tr>
        </thead>
        <tbody>
          ${state.personnel.map((person) => `
            <tr>
              <td>${h(person.payId)}</td>
              <td>${h(person.dob)}</td>
              <td><div class="person-name">${h(person.name)}</div></td>
              <td>${h(person.position)}</td>
              <td>${h(person.school)}<div class="meta">อ.${h(person.district)}</div></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderSendModal(request) {
  if (!request) return "";
  const hasCertifier = Boolean(state.settings.certifierName && state.settings.signatureDataUrl);

  return `
    <div class="modal-backdrop">
      <section class="modal" role="dialog" aria-modal="true" aria-labelledby="sendTitle">
        <div class="modal-head">
          <div>
            <h3 id="sendTitle">ส่งเอกสาร PDF</h3>
            <p class="hint">เมื่อกดส่ง ระบบจะบันทึกไฟล์และสร้างข้อมูลสำเนาถูกต้องพร้อมลายมือชื่อผู้รับรอง</p>
          </div>
          <button class="close" type="button" data-action="close-modal" aria-label="ปิด">×</button>
        </div>
        <div class="modal-body">
          ${!hasCertifier ? `<p class="warning-note">ยังไม่พบชื่อผู้รับรองหรือลายมือชื่อในหน้าแอดมิน จึงยังส่งเอกสารไม่ได้</p>` : ""}
          ${renderProfile(request)}
          <form id="sendForm">
            <input type="hidden" name="requestId" value="${attr(request.id)}">
            <div class="field">
              <label for="deliveryPdf">ไฟล์ PDF ที่จะส่ง</label>
              <input id="deliveryPdf" name="deliveryPdf" type="file" accept="application/pdf,.pdf" required>
              <p class="hint">เก็บในเครื่องนี้ด้วย localStorage แนะนำไฟล์ไม่เกิน 3 MB สำหรับเวอร์ชันทดลอง</p>
            </div>
            <div class="field">
              <label for="deliveryNote">หมายเหตุการส่ง</label>
              <textarea id="deliveryNote" name="deliveryNote" placeholder="เช่น ส่งฉบับรับรองแล้ว / เลขที่หนังสือ / หมายเหตุอื่น"></textarea>
            </div>
            <div class="cert-preview">
              <h4>ข้อมูลสำเนาถูกต้องที่จะประทับกับรายการนี้</h4>
              <div class="signature-box">
                ${state.settings.signatureDataUrl
                  ? `<img src="${state.settings.signatureDataUrl}" alt="ลายมือชื่อผู้รับรอง">`
                  : `<div class="signature-placeholder">ยังไม่ได้อัปโหลด</div>`
                }
                <strong>สำเนาถูกต้อง</strong>
                <span>(${h(state.settings.certifierName || "ยังไม่ได้ระบุชื่อ")})</span>
                <span>${h(state.settings.certifierPosition)}</span>
              </div>
            </div>
            <label class="hint" style="display:flex;gap:8px;align-items:center;margin-top:14px">
              <input type="checkbox" name="openCertAfterSend" checked>
              เปิดหน้าใบรับรองหลังบันทึก เพื่อพิมพ์หรือบันทึกเป็น PDF
            </label>
            <div class="actions end" style="margin-top:18px">
              <button class="btn ghost" type="button" data-action="close-modal">ยกเลิก</button>
              <button class="btn success ${hasCertifier ? "" : "disabled"}" type="submit" ${hasCertifier ? "" : "disabled"}>บันทึกและส่งเอกสาร</button>
            </div>
          </form>
        </div>
      </section>
    </div>
  `;
}

function handleLogin(form) {
  const data = new FormData(form);
  const username = String(data.get("username") || "").trim();
  const password = String(data.get("password") || "").trim();

  if (state.loginRole === "admin") {
    if (username === "admin" && password === "1234567890") {
      setCurrentUser({ role: "admin", name: "ผู้ดูแลระบบ" });
      showToast("เข้าสู่ระบบแอดมินสำเร็จ", "success");
      render();
      return;
    }
    showToast("ชื่อผู้ใช้หรือรหัสผ่านแอดมินไม่ถูกต้อง", "error");
    render();
    return;
  }

  if (state.loginRole === "staff") {
    if (username === "1234" && password === "1234567890") {
      setCurrentUser({ role: "staff", name: "เจ้าหน้าที่บริหารงานบุคคล" });
      showToast("เข้าสู่ระบบเจ้าหน้าที่สำเร็จ", "success");
      render();
      return;
    }
    showToast("ชื่อผู้ใช้หรือรหัสผ่านเจ้าหน้าที่ไม่ถูกต้อง", "error");
    render();
    return;
  }

  const user = state.personnel.find((person) => person.payId === username && person.dob === password);
  if (user) {
    setCurrentUser({ role: "user", ...user });
    showToast(`ยินดีต้อนรับ ${user.name}`, "success");
    render();
    return;
  }

  showToast("เลขที่จ่ายตรงหรือวันเดือนปีเกิดไม่ถูกต้อง", "error");
  render();
}

function handleCreateRequest(form) {
  const user = state.currentUser;
  if (!user || user.role !== "user") return;
  const data = new FormData(form);
  const request = {
    id: createId(),
    payId: user.payId,
    dob: user.dob,
    name: user.name,
    position: user.position,
    school: user.school,
    district: user.district,
    type: String(data.get("type") || "ปกติ"),
    appointDate: String(data.get("appointDate") || ""),
    contactPhone: String(data.get("contactPhone") || "").trim(),
    reason: String(data.get("reason") || "").trim(),
    note: String(data.get("note") || "").trim(),
    requestDate: new Date().toISOString(),
    status: "รอเจ้าหน้าที่ดำเนินการ",
    delivery: null,
    certification: null,
    sentAt: ""
  };

  state.requests = [request, ...state.requests];
  state.reuse[user.payId] = {
    type: request.type,
    contactPhone: request.contactPhone,
    reason: request.reason,
    note: request.note,
    updatedAt: new Date().toISOString()
  };
  saveJson(KEYS.requests, state.requests);
  saveJson(KEYS.reuse, state.reuse);
  showToast("ส่งคำขอเรียบร้อย ระบบบันทึกข้อมูลไว้ใช้ครั้งต่อไปแล้ว", "success");
  render();
}

async function handleSendPdf(form) {
  const requestId = String(new FormData(form).get("requestId") || "");
  const request = findRequest(requestId);
  const file = form.deliveryPdf.files?.[0];
  if (!request || !file) return;

  if (!state.settings.certifierName || !state.settings.signatureDataUrl) {
    showToast("กรุณาตั้งค่าชื่อผู้รับรองและลายมือชื่อในหน้าแอดมินก่อน", "error");
    render();
    return;
  }

  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    showToast("กรุณาเลือกไฟล์ PDF เท่านั้น", "error");
    render();
    return;
  }

  if (file.size > MAX_PDF_BYTES) {
    showToast("ไฟล์ PDF ใหญ่เกิน 3 MB สำหรับเวอร์ชันทดลอง", "error");
    render();
    return;
  }

  try {
    const data = new FormData(form);
    const dataUrl = await fileToDataUrl(file);
    const now = new Date().toISOString();
    const updated = {
      ...request,
      status: "ส่งเอกสาร PDF แล้ว",
      sentAt: now,
      delivery: {
        pdf: {
          name: file.name,
          size: file.size,
          type: "application/pdf",
          dataUrl,
          uploadedAt: now
        },
        note: String(data.get("deliveryNote") || "").trim()
      },
      certification: {
        text: "สำเนาถูกต้อง",
        certifierName: state.settings.certifierName,
        certifierPosition: state.settings.certifierPosition,
        office: state.settings.office,
        signatureDataUrl: state.settings.signatureDataUrl,
        certifiedAt: now
      }
    };

    state.requests = state.requests.map((item) => item.id === request.id ? updated : item);
    state.reuse[request.payId] = {
      type: request.type,
      contactPhone: request.contactPhone,
      reason: request.reason,
      note: request.note,
      updatedAt: now
    };

    saveJson(KEYS.requests, state.requests);
    saveJson(KEYS.reuse, state.reuse);
    state.activeSendId = null;
    showToast("ส่ง PDF และสร้างสำเนาถูกต้องพร้อมลายมือชื่อแล้ว", "success");
    render();

    if (data.get("openCertAfterSend")) {
      window.setTimeout(() => printCertifiedCopy(updated), 250);
    }
  } catch (error) {
    console.error(error);
    showToast("บันทึกไฟล์ไม่สำเร็จ กรุณาลองลดขนาดไฟล์ PDF", "error");
    render();
  }
}

async function handleSaveSettings(form) {
  const data = new FormData(form);
  const file = form.signatureFile.files?.[0];
  let signatureDataUrl = state.settings.signatureDataUrl;

  if (file) {
    if (!file.type.startsWith("image/")) {
      showToast("กรุณาเลือกไฟล์รูปภาพลายมือชื่อ", "error");
      render();
      return;
    }
    if (file.size > MAX_SIGNATURE_BYTES) {
      showToast("ไฟล์ลายมือชื่อต้องไม่เกิน 1.5 MB", "error");
      render();
      return;
    }
    signatureDataUrl = await fileToDataUrl(file);
  }

  state.settings = {
    certifierName: String(data.get("certifierName") || "").trim(),
    certifierPosition: String(data.get("certifierPosition") || "").trim(),
    office: String(data.get("office") || "").trim(),
    signatureDataUrl,
    updatedAt: new Date().toISOString()
  };

  saveJson(KEYS.settings, state.settings);
  showToast("บันทึกข้อมูลผู้รับรองเรียบร้อย", "success");
  render();
}

function handleSavePersonnel(form) {
  const data = new FormData(form);
  const person = {
    payId: String(data.get("payId") || "").trim(),
    dob: String(data.get("dob") || "").trim(),
    name: String(data.get("name") || "").trim(),
    position: String(data.get("position") || "").trim(),
    school: String(data.get("school") || "").trim(),
    district: String(data.get("district") || "").trim()
  };

  const exists = state.personnel.some((item) => item.payId === person.payId);
  state.personnel = exists
    ? state.personnel.map((item) => item.payId === person.payId ? person : item)
    : [person, ...state.personnel];
  saveJson(KEYS.personnel, state.personnel);
  showToast(exists ? "ปรับปรุงข้อมูลบุคลากรแล้ว" : "เพิ่มข้อมูลบุคลากรแล้ว", "success");
  form.reset();
  render();
}

function printCertifiedCopy(request) {
  if (!request.certification) {
    showToast("รายการนี้ยังไม่มีข้อมูลสำเนาถูกต้อง", "error");
    render();
    return;
  }

  const cert = request.certification;
  const pdf = request.delivery?.pdf;
  const win = window.open("", "_blank", "width=920,height=760");
  if (!win) {
    showToast("เบราว์เซอร์บล็อกหน้าพิมพ์ กรุณาอนุญาต popup แล้วลองใหม่", "error");
    render();
    return;
  }

  win.document.write(`
    <!doctype html>
    <html lang="th">
    <head>
      <meta charset="UTF-8">
      <title>สำเนาถูกต้อง - ${h(request.name)}</title>
      <style>
        @page { size: A4; margin: 18mm; }
        * { box-sizing: border-box; }
        body {
          margin: 0;
          color: #111827;
          font-family: "Sarabun", "Noto Sans Thai", "Leelawadee UI", sans-serif;
          background: #eef3f9;
        }
        .sheet {
          width: 210mm;
          min-height: 297mm;
          margin: 0 auto;
          padding: 18mm;
          background: white;
        }
        .no-print {
          position: sticky;
          top: 0;
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          padding: 12px;
          background: #0f315d;
        }
        .no-print button {
          border: 0;
          border-radius: 8px;
          padding: 10px 14px;
          color: white;
          background: #17457f;
          font: inherit;
          font-weight: 700;
          cursor: pointer;
        }
        .heading {
          text-align: center;
          border-bottom: 3px solid #17457f;
          padding-bottom: 14px;
          margin-bottom: 24px;
        }
        h1 {
          margin: 0;
          color: #0f315d;
          font-size: 28px;
        }
        .stamp {
          display: inline-block;
          margin-top: 18px;
          padding: 10px 26px;
          color: #b91c1c;
          border: 4px solid #b91c1c;
          border-radius: 8px;
          font-size: 34px;
          font-weight: 800;
          transform: rotate(-3deg);
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 18px 0 24px;
        }
        th, td {
          text-align: left;
          border: 1px solid #cbd5e1;
          padding: 10px 12px;
          vertical-align: top;
        }
        th {
          width: 32%;
          background: #f1f5f9;
        }
        .cert-text {
          margin: 24px 0;
          line-height: 1.8;
          font-size: 17px;
        }
        .sign {
          margin-top: 42px;
          margin-left: auto;
          width: 320px;
          text-align: center;
        }
        .sign img {
          max-width: 260px;
          max-height: 95px;
          object-fit: contain;
        }
        .sign-line {
          border-top: 1px solid #111827;
          margin-top: 6px;
          padding-top: 8px;
        }
        .muted { color: #64748b; }
        @media print {
          body { background: white; }
          .sheet { width: auto; min-height: auto; margin: 0; padding: 0; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="no-print">
        <button onclick="window.print()">พิมพ์ / บันทึกเป็น PDF</button>
        <button onclick="window.close()">ปิด</button>
      </div>
      <main class="sheet">
        <section class="heading">
          <h1>ใบรับรองสำเนาถูกต้อง</h1>
          <div class="muted">${h(cert.office)}</div>
          <div class="stamp">${h(cert.text)}</div>
        </section>

        <table>
          <tr><th>ผู้ขอ</th><td>${h(request.name)}</td></tr>
          <tr><th>ตำแหน่ง</th><td>${h(request.position)}</td></tr>
          <tr><th>สถานศึกษา</th><td>${h(request.school)} อ.${h(request.district)}</td></tr>
          <tr><th>เลขที่จ่ายตรง</th><td>${h(request.payId)}</td></tr>
          <tr><th>ประเภทการขอ</th><td>${h(request.type)}</td></tr>
          <tr><th>วันที่ยื่นคำขอ</th><td>${formatThaiDate(request.requestDate)}</td></tr>
          <tr><th>ไฟล์ PDF ที่ส่ง</th><td>${pdf ? h(pdf.name) : "-"}</td></tr>
          <tr><th>วันที่รับรอง</th><td>${formatThaiDateTime(cert.certifiedAt)}</td></tr>
        </table>

        <p class="cert-text">
          ข้าพเจ้าขอรับรองว่าเอกสาร PDF ที่จัดส่งให้แก่ผู้ขอตามรายการข้างต้น
          เป็นสำเนาถูกต้องจากข้อมูลในระบบการขอ ก.พ.7 / ก.ค.ศ.16 ONLINE
          และได้บันทึกการจัดส่งไว้ในระบบเรียบร้อยแล้ว
        </p>

        <section class="sign">
          <img src="${cert.signatureDataUrl}" alt="ลายมือชื่อผู้รับรอง">
          <div class="sign-line">(${h(cert.certifierName)})</div>
          <div>${h(cert.certifierPosition)}</div>
          <div class="muted">${h(cert.office)}</div>
        </section>
      </main>
      <script>
        window.setTimeout(() => window.print(), 350);
      </script>
    </body>
    </html>
  `);
  win.document.close();
}

function setCurrentUser(user) {
  state.currentUser = user;
  sessionStorage.setItem(KEYS.session, JSON.stringify(user));
}

function createSeedRequests() {
  const requestDate = new Date();
  const appointDate = new Date();
  appointDate.setDate(appointDate.getDate() + 7);

  return [
    {
      id: createId(),
      payId: "1001",
      dob: "01012530",
      name: "นายสมชาย ใจดี",
      position: "ครู คศ.1",
      school: "โรงเรียนบ้านนา",
      district: "สว่างแดนดิน",
      type: "ปกติ",
      appointDate: toDateInput(appointDate),
      contactPhone: "081-234-5678",
      reason: "ขอใช้ประกอบการทำธุรกรรม",
      note: "",
      requestDate: requestDate.toISOString(),
      status: "รอเจ้าหน้าที่ดำเนินการ",
      delivery: null,
      certification: null,
      sentAt: ""
    }
  ];
}

function findRequest(id) {
  return state.requests.find((request) => request.id === id);
}

function isCompleted(request) {
  return Boolean(request.sentAt || request.delivery?.pdf);
}

function roleLabel(role) {
  if (role === "admin") return "ผู้ดูแลระบบ";
  if (role === "staff") return "เจ้าหน้าที่";
  return "ผู้ขอเอกสาร";
}

function createId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `req-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function nextDateInput(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return toDateInput(date);
}

function toDateInput(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatThaiDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return h(value);
  return date.toLocaleDateString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function formatThaiDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return h(value);
  return date.toLocaleString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatBytes(bytes) {
  if (!bytes) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function showToast(message, type = "info") {
  state.toast = { message, type };
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    state.toast = null;
    render();
  }, 3200);
}

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return typeof fallback === "function" ? fallback() : clone(fallback);
    return JSON.parse(raw);
  } catch (error) {
    console.warn(`Cannot load ${key}`, error);
    return typeof fallback === "function" ? fallback() : clone(fallback);
  }
}

function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function h(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function attr(value) {
  return h(value);
}
