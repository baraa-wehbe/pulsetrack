import assert from "node:assert/strict";

const BASE_URL = "http://localhost:3000";
const email = process.env.PULSETRACK_E2E_EMAIL;
const password = process.env.PULSETRACK_E2E_PASSWORD;

if (!email || !password) {
  throw new Error(
    "PULSETRACK_E2E_EMAIL and PULSETRACK_E2E_PASSWORD are required.",
  );
}

const request = (path, options = {}) =>
  fetch(`${BASE_URL}${path}`, { redirect: "manual", ...options });

const cookieValue = (response) =>
  response.headers.get("set-cookie").split(";")[0];

const main = async () => {
  const anonymousPrivateRoutes = [
    "/patients",
    "/lab-uploads",
    "/dashboard",
    "/dashboard/clinic",
    "/dashboard/patient",
  ];

  for (const path of anonymousPrivateRoutes) {
    const response = await request(path);
    assert.ok([303, 307, 308].includes(response.status));
    assert.equal(
      new URL(response.headers.get("location"), BASE_URL).pathname,
      "/login",
    );
  }

  const loginPage = await request("/login");
  const loginHtml = await loginPage.text();
  assert.equal(loginPage.status, 200);
  assert.doesNotMatch(loginHtml, /<header|id="main-content"/);

  const login = await request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(login.status, 200);
  const authCookie = cookieValue(login);

  const patients = await request("/patients", {
    headers: { Cookie: authCookie },
  });
  const patientsHtml = await patients.text();
  assert.equal(patients.status, 200);
  assert.match(patientsHtml, /<html[^>]*dir="ltr"[^>]*lang="en"/);
  assert.match(patientsHtml, /Patients/);
  assert.match(patientsHtml, /Lab Uploads/);
  assert.match(patientsHtml, /Clinic Dashboard/);
  assert.match(patientsHtml, /Patient Dashboard/);
  assert.match(patientsHtml, /href="#main-content"/);
  assert.doesNotMatch(patientsHtml, /passwordHash|pulsetrack_session/);

  const invalidPreference = await request("/api/private/preferences", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: authCookie,
    },
    body: JSON.stringify({ kind: "theme", value: "system" }),
  });
  assert.equal(invalidPreference.status, 400);
  assert.equal(invalidPreference.headers.get("set-cookie"), null);

  const languageUpdate = await request("/api/private/preferences", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: authCookie,
    },
    body: JSON.stringify({ kind: "language", value: "ar" }),
  });
  assert.equal(languageUpdate.status, 200);
  const languageCookie = cookieValue(languageUpdate);
  assert.match(languageCookie, /^pulsetrack_language=ar$/);
  const languageSetCookie = languageUpdate.headers.get("set-cookie");
  assert.match(languageSetCookie, /HttpOnly/i);
  assert.match(languageSetCookie, /SameSite=Lax/i);
  assert.match(languageSetCookie, /Path=\//i);

  const themeUpdate = await request("/api/private/preferences", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `${authCookie}; ${languageCookie}`,
    },
    body: JSON.stringify({ kind: "theme", value: "dark" }),
  });
  assert.equal(themeUpdate.status, 200);
  const themeCookie = cookieValue(themeUpdate);
  assert.match(themeCookie, /^pulsetrack_theme=dark$/);

  const allCookies = `${authCookie}; ${languageCookie}; ${themeCookie}`;
  const arabicDashboard = await request("/dashboard/patient", {
    headers: { Cookie: allCookies },
  });
  const arabicHtml = await arabicDashboard.text();
  assert.equal(arabicDashboard.status, 200);
  assert.match(
    arabicHtml,
    /<html[^>]*class="dark"[^>]*data-theme="dark"[^>]*dir="rtl"[^>]*lang="ar"/,
  );
  assert.match(arabicHtml, /لوحة متابعة المريض/);
  assert.match(arabicHtml, /رفع التحاليل المخبرية/);

  const logout = await request("/api/auth/logout", {
    method: "POST",
    headers: { Cookie: allCookies },
  });
  assert.equal(logout.status, 204);
  assert.doesNotMatch(
    logout.headers.get("set-cookie"),
    /pulsetrack_language|pulsetrack_theme/,
  );

  const preferencesAfterLogout = await request("/login", {
    headers: { Cookie: `${languageCookie}; ${themeCookie}` },
  });
  const loggedOutHtml = await preferencesAfterLogout.text();
  assert.equal(preferencesAfterLogout.status, 200);
  assert.match(
    loggedOutHtml,
    /<html[^>]*class="dark"[^>]*data-theme="dark"[^>]*dir="rtl"[^>]*lang="ar"/,
  );
  assert.match(loggedOutHtml, /تسجيل دخول الطبيب/);
  assert.doesNotMatch(loggedOutHtml, /<header|id="main-content"/);

  console.log(
    "Application shell HTTP verification passed without exposing credentials.",
  );
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
