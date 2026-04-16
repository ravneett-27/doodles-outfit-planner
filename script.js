const STORAGE_KEY = "doodles-outfit-planner";

const defaultState = {
    items: [
        {
            id: crypto.randomUUID(),
            name: "Cream Knit Sweater",
            category: "Tops",
            color: "Cream",
            season: "Winter",
            vibe: "Cozy",
            notes: "Soft oversized fit for colder days.",
            createdAt: Date.now() - 300000
        },
        {
            id: crypto.randomUUID(),
            name: "Black Wide-Leg Trousers",
            category: "Bottoms",
            color: "Black",
            season: "All Season",
            vibe: "Minimal",
            notes: "Easy base for casual or dressed-up outfits.",
            createdAt: Date.now() - 200000
        },
        {
            id: crypto.randomUUID(),
            name: "White Sneakers",
            category: "Shoes",
            color: "White",
            season: "All Season",
            vibe: "Everyday",
            notes: "Clean finish for casual looks.",
            createdAt: Date.now() - 100000
        }
    ],
    outfits: []
};

const state = loadState();

const ui = {
    currentPage: "home",
    searchTerm: "",
    categoryFilter: "all",
    sortItems: "newest",
    selectedItemIds: new Set()
};

document.addEventListener("DOMContentLoaded", () => {
    bindEvents();
    renderApp();
});

function bindEvents() {
    document.querySelectorAll("[data-page-link]").forEach((button) => {
        button.addEventListener("click", (event) => {
            event.preventDefault();
            showPage(button.dataset.pageLink);
        });
    });

    document.querySelectorAll("[data-scroll-target]").forEach((button) => {
        button.addEventListener("click", (event) => {
            event.preventDefault();
            const targetId = button.dataset.scrollTarget;

            if (button.dataset.pageLink) {
                showPage(button.dataset.pageLink);
            } else {
                showPage("wardrobe");
            }

            scrollToSection(targetId);
        });
    });

    document.getElementById("global-search").addEventListener("input", (event) => {
        ui.searchTerm = event.target.value.trim().toLowerCase();
        renderApp();
    });

    document.getElementById("category-filter").addEventListener("change", (event) => {
        ui.categoryFilter = event.target.value;
        renderWardrobe();
    });

    document.getElementById("sort-items").addEventListener("change", (event) => {
        ui.sortItems = event.target.value;
        renderWardrobe();
    });

    document.getElementById("item-form").addEventListener("submit", handleItemSubmit);
    document.getElementById("cancel-edit").addEventListener("click", resetItemForm);

    document.getElementById("outfit-form").addEventListener("submit", handleOutfitSubmit);
    document.getElementById("reset-builder").addEventListener("click", resetBuilderForm);
}

function loadState() {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) {
        return structuredClone(defaultState);
    }

    try {
        const parsed = JSON.parse(saved);
        return {
            items: Array.isArray(parsed.items) ? parsed.items : structuredClone(defaultState.items),
            outfits: Array.isArray(parsed.outfits) ? parsed.outfits : []
        };
    } catch (error) {
        console.error("Unable to parse saved planner data.", error);
        return structuredClone(defaultState);
    }
}

function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function showPage(pageName) {
    ui.currentPage = pageName;

    document.querySelectorAll(".page").forEach((page) => {
        page.classList.toggle("active", page.id === `page-${pageName}`);
    });

    document.querySelectorAll(".nav-link").forEach((link) => {
        link.classList.toggle("active", link.dataset.pageLink === pageName);
    });

    if (pageName !== "wardrobe") {
        resetItemForm();
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderApp() {
    renderDashboard();
    renderWardrobe();
    renderBuilder();
    renderOutfits();
}

function renderDashboard() {
    document.getElementById("home-item-count").textContent = state.items.length;
    document.getElementById("home-outfit-count").textContent = state.outfits.length;
    document.getElementById("home-color-highlight").textContent = getTopColor();

    const recentItems = [...state.items]
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 3);

    document.getElementById("recent-items").innerHTML = recentItems.length
        ? recentItems.map((item) => miniCardMarkup(item.name, `${item.category} | ${item.color}`)).join("")
        : emptyMarkup("No wardrobe items yet. Add your first piece to get started.");

    const recentOutfits = [...state.outfits]
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 3);

    document.getElementById("recent-outfits").innerHTML = recentOutfits.length
        ? recentOutfits.map((outfit) => miniCardMarkup(outfit.name, `${outfit.itemIds.length} pieces | ${outfit.occasion}`)).join("")
        : emptyMarkup("No saved outfits yet. Build one from the outfit builder.");
}

function renderWardrobe() {
    const wardrobeGrid = document.getElementById("wardrobe-grid");
    const filteredItems = getFilteredItems();

    document.getElementById("wardrobe-summary").textContent = `${filteredItems.length} item${filteredItems.length === 1 ? "" : "s"} shown`;

    if (!filteredItems.length) {
        wardrobeGrid.innerHTML = emptyMarkup("No items match your current search or category filter.");
        return;
    }

    wardrobeGrid.innerHTML = filteredItems.map((item) => `
        <article class="card item-card">
            <div class="card-swatch" style="background:${getColorToken(item.color)};"></div>
            <div class="card-body">
                <div class="card-header">
                    <div>
                        <p class="card-category">${escapeHtml(item.category)}</p>
                        <h3>${escapeHtml(item.name)}</h3>
                    </div>
                    <span class="pill">${escapeHtml(item.color)}</span>
                </div>
                <p class="card-meta">${escapeHtml(item.season || "All Season")} | ${escapeHtml(item.vibe || "No vibe added")}</p>
                <p class="card-notes">${escapeHtml(item.notes || "No notes added yet.")}</p>
                <div class="card-actions">
                    <button class="ghost-btn" data-edit-item="${item.id}">Edit</button>
                    <button class="ghost-btn danger" data-delete-item="${item.id}">Delete</button>
                </div>
            </div>
        </article>
    `).join("");

    wardrobeGrid.querySelectorAll("[data-edit-item]").forEach((button) => {
        button.addEventListener("click", () => startEditItem(button.dataset.editItem));
    });

    wardrobeGrid.querySelectorAll("[data-delete-item]").forEach((button) => {
        button.addEventListener("click", () => deleteItem(button.dataset.deleteItem));
    });
}

function renderBuilder() {
    const builderSelection = document.getElementById("builder-selection");
    const selectedItemsList = document.getElementById("selected-items-list");
    const builderItems = getFilteredItems();

    if (!builderItems.length) {
        builderSelection.innerHTML = emptyMarkup("Add wardrobe pieces first so you can select them here.");
    } else {
        builderSelection.innerHTML = builderItems.map((item) => `
            <button class="card selector-card ${ui.selectedItemIds.has(item.id) ? "selected" : ""}" type="button" data-toggle-item="${item.id}">
                <span class="selector-swatch" style="background:${getColorToken(item.color)};"></span>
                <span class="selector-title">${escapeHtml(item.name)}</span>
                <span class="selector-meta">${escapeHtml(item.category)} | ${escapeHtml(item.color)}</span>
            </button>
        `).join("");

        builderSelection.querySelectorAll("[data-toggle-item]").forEach((button) => {
            button.addEventListener("click", () => toggleSelectedItem(button.dataset.toggleItem));
        });
    }

    const selectedItems = state.items.filter((item) => ui.selectedItemIds.has(item.id));
    selectedItemsList.innerHTML = selectedItems.length
        ? selectedItems.map((item) => `<li>${escapeHtml(item.name)} <span>${escapeHtml(item.category)}</span></li>`).join("")
        : `<li class="empty-line">No pieces selected yet.</li>`;
}

function renderOutfits() {
    const outfitsGrid = document.getElementById("outfits-grid");

    if (!state.outfits.length) {
        outfitsGrid.innerHTML = emptyMarkup("No outfits saved yet. Head to the builder and create one.");
        return;
    }

    outfitsGrid.innerHTML = [...state.outfits]
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((outfit) => {
            const pieces = outfit.itemIds
                .map((itemId) => state.items.find((item) => item.id === itemId))
                .filter(Boolean);

            return `
                <article class="card outfit-card">
                    <div class="card-body">
                        <div class="card-header">
                            <div>
                                <p class="card-category">${escapeHtml(outfit.occasion)}</p>
                                <h3>${escapeHtml(outfit.name)}</h3>
                            </div>
                            <span class="pill">${pieces.length} pieces</span>
                        </div>
                        <p class="card-notes">${escapeHtml(outfit.notes || "No notes for this outfit.")}</p>
                        <div class="tag-row">
                            ${pieces.map((piece) => `<span class="tag">${escapeHtml(piece.name)}</span>`).join("")}
                        </div>
                        <div class="card-actions">
                            <button class="ghost-btn danger" data-delete-outfit="${outfit.id}">Delete Outfit</button>
                        </div>
                    </div>
                </article>
            `;
        }).join("");

    outfitsGrid.querySelectorAll("[data-delete-outfit]").forEach((button) => {
        button.addEventListener("click", () => deleteOutfit(button.dataset.deleteOutfit));
    });
}

function handleItemSubmit(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    const itemId = formData.get("itemId");

    const item = {
        id: itemId || crypto.randomUUID(),
        name: formData.get("name").toString().trim(),
        category: formData.get("category").toString().trim(),
        color: formData.get("color").toString().trim(),
        season: formData.get("season").toString().trim(),
        vibe: formData.get("vibe").toString().trim(),
        notes: formData.get("notes").toString().trim(),
        createdAt: itemId ? getExistingCreatedAt(itemId) : Date.now()
    };

    if (itemId) {
        const index = state.items.findIndex((existingItem) => existingItem.id === itemId);
        state.items[index] = item;
    } else {
        state.items.unshift(item);
    }

    saveState();
    resetItemForm();
    renderApp();
    showPage("wardrobe");
    scrollToSection("wardrobe-grid");
}

function handleOutfitSubmit(event) {
    event.preventDefault();

    if (!ui.selectedItemIds.size) {
        alert("Select at least one clothing item before saving an outfit.");
        return;
    }

    const formData = new FormData(event.currentTarget);

    state.outfits.unshift({
        id: crypto.randomUUID(),
        name: formData.get("outfitName").toString().trim(),
        occasion: formData.get("occasion").toString().trim(),
        notes: formData.get("notes").toString().trim(),
        itemIds: [...ui.selectedItemIds],
        createdAt: Date.now()
    });

    saveState();
    resetBuilderForm();
    renderApp();
    showPage("outfits");
}

function startEditItem(itemId) {
    const item = state.items.find((entry) => entry.id === itemId);

    if (!item) {
        return;
    }

    document.getElementById("item-id").value = item.id;
    document.getElementById("item-name").value = item.name;
    document.getElementById("item-category").value = item.category;
    document.getElementById("item-color").value = item.color;
    document.getElementById("item-season").value = item.season || "All Season";
    document.getElementById("item-vibe").value = item.vibe || "";
    document.getElementById("item-notes").value = item.notes || "";

    showPage("wardrobe");
    scrollToSection("wardrobe-form-panel");
}

function deleteItem(itemId) {
    state.items = state.items.filter((item) => item.id !== itemId);
    state.outfits = state.outfits
        .map((outfit) => ({ ...outfit, itemIds: outfit.itemIds.filter((id) => id !== itemId) }))
        .filter((outfit) => outfit.itemIds.length);
    ui.selectedItemIds.delete(itemId);

    saveState();
    renderApp();
}

function deleteOutfit(outfitId) {
    state.outfits = state.outfits.filter((outfit) => outfit.id !== outfitId);
    saveState();
    renderApp();
}

function toggleSelectedItem(itemId) {
    if (ui.selectedItemIds.has(itemId)) {
        ui.selectedItemIds.delete(itemId);
    } else {
        ui.selectedItemIds.add(itemId);
    }

    renderBuilder();
}

function resetItemForm() {
    document.getElementById("item-form").reset();
    document.getElementById("item-id").value = "";
    document.getElementById("item-season").value = "All Season";
}

function resetBuilderForm() {
    document.getElementById("outfit-form").reset();
    ui.selectedItemIds.clear();
    renderBuilder();
}

function getFilteredItems() {
    const filteredBySearch = state.items.filter((item) => {
        const searchable = `${item.name} ${item.category} ${item.color} ${item.vibe} ${item.notes}`.toLowerCase();
        return searchable.includes(ui.searchTerm);
    });

    const filteredByCategory = ui.categoryFilter === "all"
        ? filteredBySearch
        : filteredBySearch.filter((item) => item.category === ui.categoryFilter);

    return filteredByCategory.sort((first, second) => {
        if (ui.sortItems === "oldest") {
            return first.createdAt - second.createdAt;
        }

        if (ui.sortItems === "name") {
            return first.name.localeCompare(second.name);
        }

        if (ui.sortItems === "category") {
            return first.category.localeCompare(second.category) || first.name.localeCompare(second.name);
        }

        return second.createdAt - first.createdAt;
    });
}

function getExistingCreatedAt(itemId) {
    return state.items.find((item) => item.id === itemId)?.createdAt ?? Date.now();
}

function getTopColor() {
    if (!state.items.length) {
        return "-";
    }

    const colors = state.items.reduce((accumulator, item) => {
        const key = item.color.trim().toLowerCase();
        accumulator[key] = (accumulator[key] || 0) + 1;
        return accumulator;
    }, {});

    const [topColor] = Object.entries(colors).sort((first, second) => second[1] - first[1])[0];
    return topColor.charAt(0).toUpperCase() + topColor.slice(1);
}

function miniCardMarkup(title, meta) {
    return `
        <article class="mini-card">
            <strong>${escapeHtml(title)}</strong>
            <span>${escapeHtml(meta)}</span>
        </article>
    `;
}

function emptyMarkup(message) {
    return `<div class="empty-state">${escapeHtml(message)}</div>`;
}

function getColorToken(colorName) {
    const normalized = colorName.trim().toLowerCase();
    const colorMap = {
        black: "#1f1d1b",
        white: "#f5f1ea",
        cream: "#f2e8d5",
        beige: "#dcc9ab",
        brown: "#9b6c4d",
        blue: "#7ba3d8",
        navy: "#32496d",
        green: "#90b48d",
        red: "#d96b6b",
        pink: "#f0b6c4",
        gray: "#a7abb3"
    };

    return colorMap[normalized] || "#d9c7f2";
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function scrollToSection(sectionId) {
    const section = document.getElementById(sectionId);

    if (!section) {
        return;
    }

    requestAnimationFrame(() => {
        section.scrollIntoView({ behavior: "smooth", block: "start" });
    });
}
