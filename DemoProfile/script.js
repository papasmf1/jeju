const menuToggle = document.querySelector(".menu-toggle");
const primaryNav = document.querySelector("#primary-nav");

if (menuToggle && primaryNav) {
  menuToggle.addEventListener("click", () => {
    const isExpanded = menuToggle.getAttribute("aria-expanded") === "true";
    menuToggle.setAttribute("aria-expanded", String(!isExpanded));
    menuToggle.setAttribute("aria-label", isExpanded ? "메뉴 열기" : "메뉴 닫기");
    primaryNav.classList.toggle("is-open", !isExpanded);
  });
}

document.querySelectorAll("[data-year]").forEach((year) => {
  year.textContent = String(new Date().getFullYear());
});

const copyButton = document.querySelector("[data-copy-email]");

if (copyButton) {
  const status = document.querySelector(".copy-status");
  copyButton.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText("papasmf1@gmail.com");
      if (status) status.textContent = "이메일 주소를 복사했습니다.";
    } catch (error) {
      if (status) status.textContent = "복사할 수 없습니다. 이메일 주소를 직접 선택해 주세요.";
      console.error("이메일 주소 복사에 실패했습니다.", error);
    }
  });
}
