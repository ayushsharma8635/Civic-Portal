export function showToast(message, type = "success", duration = 3000) {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast-message ${type}`;

  toast.innerHTML = `
    <strong>${message}</strong>
    <button class="toast-close" aria-label="Close">&times;</button>
  `;

  container.appendChild(toast);

  const closeButton = toast.querySelector(".toast-close");

  closeButton.addEventListener("click", function () {
    removeToast(toast);
  });

  setTimeout(function () {
    removeToast(toast);
  }, duration);
}

function removeToast(toast) {
  if (!toast || !toast.parentElement) {
    return;
  }

  toast.style.animation = "toastOut 0.3s ease forwards";

  setTimeout(function () {
    if (toast.parentElement) {
      toast.remove();
    }
  }, 300);
}