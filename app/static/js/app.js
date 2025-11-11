(() => {
  const TIER_OPTIONS = [
    "ULV",
    "LV",
    "MV",
    "HV",
    "EV",
    "IV",
    "LuV",
    "ZPM",
    "UV",
    "UHV",
    "UEV",
    "UIV",
    "UMV",
    "UXV",
  ];
  const COIL_OPTIONS = [
    "Cupronickel",
    "Kanthal",
    "Nichrome",
    "Tungstensteel",
    "HSS-G",
    "HSS-E",
    "HSS-S",
    "Naquadah",
    "Naquadah Alloy",
    "Trinium",
    "Naquadah Superconductor",
  ];
  const CUSTOM_VALUE = "__custom__";

  const state = {
    recipes: [],
    plan: null,
    catalog: [],
    catalogByMachine: {},
    editingIndex: null,
  };

  const recipeForm = document.querySelector("#recipe-form");
  const recipeIndexField = document.querySelector("#recipe-index");
  const targetForm = document.querySelector("#target-form");
  const recipeTable = document.querySelector("#recipe-table");
  const machineTable = document.querySelector("#machine-table");
  const energyTable = document.querySelector("#energy-table");
  const rawList = document.querySelector("#raw-list");
  const producedList = document.querySelector("#produced-list");
  const byproductList = document.querySelector("#byproduct-list");
  const alertBox = document.querySelector("#alert-box");
  const mermaidSource = document.querySelector("#mermaid-source");
  const mermaidDiagram = document.querySelector("#mermaid-diagram");
  const loadSample = document.querySelector("#load-sample");
  const importInput = document.querySelector("#import-input");
  const importButton = document.querySelector("#import-button");
  const exportButton = document.querySelector("#export-button");
  const targetItemInput = document.querySelector("#target-item");
  const targetAmountInput = document.querySelector("#target-amount");

  const recipeIdInput = document.querySelector("#recipe-id");
  const recipeMachineInput = document.querySelector("#recipe-machine");
  const recipeTierSelect = document.querySelector("#recipe-tier");
  const recipeTierCustom = document.querySelector("#recipe-tier-custom");
  const recipeCoilsSelect = document.querySelector("#recipe-coils");
  const recipeCoilsCustom = document.querySelector("#recipe-coils-custom");
  const recipeHeatInput = document.querySelector("#recipe-heat");
  const recipeEuInput = document.querySelector("#recipe-eut");
  const recipeDurationInput = document.querySelector("#recipe-duration");
  const recipeCancelButton = document.querySelector("#recipe-cancel");

  const inputItem = document.querySelector("#input-item");
  const inputAmount = document.querySelector("#input-amount");
  const addInputButton = document.querySelector("#add-input");
  const inputList = document.querySelector("#input-list");

  const outputItem = document.querySelector("#output-item");
  const outputAmount = document.querySelector("#output-amount");
  const addOutputButton = document.querySelector("#add-output");
  const outputList = document.querySelector("#output-list");

  const energyAverageBox = document.querySelector("#energy-average");
  const energyPeakBox = document.querySelector("#energy-peak");
  const energyAverageAmpsBox = document.querySelector("#energy-average-amps");
  const energyPeakAmpsBox = document.querySelector("#energy-peak-amps");

  const catalogMachineSelect = document.querySelector("#catalog-machine");
  const catalogRecipeSelect = document.querySelector("#catalog-recipe");
  const catalogAddButton = document.querySelector("#catalog-add");
  const catalogInfo = document.querySelector("#catalog-info");

  let currentInputs = [];
  let currentOutputs = [];
  let messageTimeout;
  let currentNotes = {};
  let renderCounter = 0;

  function populateSelectOptions(select, options, { includeCustom = false } = {}) {
    const existing = new Set(Array.from(select.options).map((option) => option.value));
    options.forEach((value) => {
      if (existing.has(value)) {
        return;
      }
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    });
    if (includeCustom && !existing.has(CUSTOM_VALUE)) {
      const option = document.createElement("option");
      option.value = CUSTOM_VALUE;
      option.textContent = "Eigen waarde...";
      select.appendChild(option);
    }
  }

  function toggleCustomField(select, customInput) {
    if (select.value === CUSTOM_VALUE) {
      customInput.classList.remove("hidden");
      return;
    }
    customInput.classList.add("hidden");
    customInput.value = "";
  }

  function getTierValue() {
    if (recipeTierSelect.value === CUSTOM_VALUE) {
      return recipeTierCustom.value.trim();
    }
    return recipeTierSelect.value.trim();
  }

  function getCoilsValue() {
    if (recipeCoilsSelect.value === CUSTOM_VALUE) {
      return recipeCoilsCustom.value.trim();
    }
    return recipeCoilsSelect.value.trim();
  }

  function setTierValue(value) {
    const target = (value ?? "").toString().trim();
    if (!target) {
      recipeTierSelect.value = "";
      toggleCustomField(recipeTierSelect, recipeTierCustom);
      return;
    }
    const match = TIER_OPTIONS.find((option) => option.toLowerCase() === target.toLowerCase());
    if (match) {
      recipeTierSelect.value = match;
      toggleCustomField(recipeTierSelect, recipeTierCustom);
      return;
    }
    recipeTierSelect.value = CUSTOM_VALUE;
    recipeTierCustom.value = target;
    recipeTierCustom.classList.remove("hidden");
  }

  function setCoilValue(value) {
    const target = (value ?? "").toString().trim();
    if (!target) {
      recipeCoilsSelect.value = "";
      toggleCustomField(recipeCoilsSelect, recipeCoilsCustom);
      return;
    }
    const match = COIL_OPTIONS.find((option) => option.toLowerCase() === target.toLowerCase());
    if (match) {
      recipeCoilsSelect.value = match;
      toggleCustomField(recipeCoilsSelect, recipeCoilsCustom);
      return;
    }
    recipeCoilsSelect.value = CUSTOM_VALUE;
    recipeCoilsCustom.value = target;
    recipeCoilsCustom.classList.remove("hidden");
  }

  populateSelectOptions(recipeTierSelect, TIER_OPTIONS, { includeCustom: true });
  populateSelectOptions(recipeCoilsSelect, COIL_OPTIONS, { includeCustom: true });

  recipeTierSelect.addEventListener("change", () => toggleCustomField(recipeTierSelect, recipeTierCustom));
  recipeCoilsSelect.addEventListener("change", () => toggleCustomField(recipeCoilsSelect, recipeCoilsCustom));
  toggleCustomField(recipeTierSelect, recipeTierCustom);
  toggleCustomField(recipeCoilsSelect, recipeCoilsCustom);

  if (window.mermaid) {
    window.mermaid.initialize({ startOnLoad: false, theme: "dark", securityLevel: "loose" });
  }

  function setMessage(message, level = "info") {
    clearTimeout(messageTimeout);
    if (!message) {
      alertBox.textContent = "";
      alertBox.removeAttribute("data-level");
      return;
    }
    alertBox.textContent = message;
    alertBox.setAttribute("data-level", level);
    if (level === "info") {
      messageTimeout = setTimeout(() => {
        alertBox.textContent = "";
        alertBox.removeAttribute("data-level");
      }, 7000);
    }
  }

  window.flowNote = (nodeId) => {
    const note = currentNotes[nodeId];
    if (!note) {
      return;
    }
    setMessage(note, "info");
  };

  function formatAmount(value) {
    if (Number.isNaN(value)) {
      return "0";
    }
    const abs = Math.abs(value);
    if (abs >= 100) {
      return value.toLocaleString("nl-NL", { maximumFractionDigits: 0 });
    }
    return value.toLocaleString("nl-NL", { maximumFractionDigits: 3 });
  }

  function formatOptional(value, { suffix = "" } = {}) {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return "-";
    }
    return `${formatAmount(value)}${suffix}`;
  }

  function parseAmount(value) {
    const number = Number.parseFloat(value);
    return Number.isNaN(number) ? 0 : number;
  }

  function ensureUniqueRecipeId(baseId) {
    let candidate = baseId;
    let counter = 1;
    while (state.recipes.some((recipe) => recipe.id === candidate)) {
      candidate = `${baseId}-${counter}`;
      counter += 1;
    }
    return candidate;
  }

  function normaliseRecipe(raw) {
    if (!raw || typeof raw !== "object") {
      return null;
    }
    const id = (raw.id ?? raw.identifier ?? "").toString().trim();
    const machine = (raw.machine ?? "").toString().trim();
    const tier = (raw.tier ?? "").toString().trim();
    if (!id || !machine || !tier) {
      return null;
    }

    const coilsRaw = raw.coils ?? null;
    const coils = coilsRaw === null || coilsRaw === undefined || coilsRaw === ""
      ? null
      : coilsRaw.toString();

    const heatValue =
      raw.heat === undefined || raw.heat === null ? null : Number.parseInt(raw.heat, 10);

    const inputs = Array.isArray(raw.inputs)
      ? raw.inputs
          .map((entry) => {
            if (!entry || typeof entry !== "object") {
              return null;
            }
            const item = (entry.item ?? "").toString().trim();
            if (!item) {
              return null;
            }
            return { item, amount: parseAmount(entry.amount ?? 0) };
          })
          .filter(Boolean)
      : [];

    const outputs = Array.isArray(raw.outputs)
      ? raw.outputs
          .map((entry) => {
            if (!entry || typeof entry !== "object") {
              return null;
            }
            const item = (entry.item ?? "").toString().trim();
            if (!item) {
              return null;
            }
            return { item, amount: parseAmount(entry.amount ?? 0) };
          })
          .filter(Boolean)
      : [];

    if (!outputs.length) {
      return null;
    }

    return {
      id,
      machine,
      tier,
      coils,
      heat: heatValue,
      eu_per_tick: parseAmount(raw.eu_per_tick ?? raw.eut ?? 0),
      duration: parseAmount(raw.duration ?? 0),
      inputs,
      outputs,
    };
  }

  function resetIngredientLists() {
    currentInputs = [];
    currentOutputs = [];
    renderIngredientList(inputList, currentInputs);
    renderIngredientList(outputList, currentOutputs);
  }

  function renderIngredientList(container, list) {
    container.innerHTML = "";
    if (!list.length) {
      const empty = document.createElement("li");
      empty.textContent = "Nog niets toegevoegd";
      empty.className = "empty";
      container.appendChild(empty);
      return;
    }
    list.forEach((entry, index) => {
      const item = document.createElement("li");
      item.innerHTML = `<strong>${entry.item}</strong> ${formatAmount(entry.amount)}`;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "✕";
      remove.addEventListener("click", () => {
        list.splice(index, 1);
        renderIngredientList(container, list);
      });
      item.appendChild(remove);
      container.appendChild(item);
    });
  }

  function resetRecipeEditor() {
    recipeForm.reset();
    recipeIndexField.value = "";
    state.editingIndex = null;
    recipeCancelButton.classList.add("hidden");
    setTierValue("");
    setCoilValue("");
    resetIngredientLists();
  }

  function startEditingRecipe(index, { silent = false } = {}) {
    const recipe = state.recipes[index];
    if (!recipe) {
      return;
    }
    state.editingIndex = index;
    recipeIndexField.value = String(index);
    recipeIdInput.value = recipe.id;
    recipeMachineInput.value = recipe.machine;
    setTierValue(recipe.tier);
    setCoilValue(recipe.coils);
    recipeHeatInput.value = recipe.heat ?? "";
    recipeEuInput.value = recipe.eu_per_tick;
    recipeDurationInput.value = recipe.duration;
    currentInputs = recipe.inputs.map((entry) => ({ ...entry }));
    currentOutputs = recipe.outputs.map((entry) => ({ ...entry }));
    renderIngredientList(inputList, currentInputs);
    renderIngredientList(outputList, currentOutputs);
    recipeCancelButton.classList.remove("hidden");
    if (!silent) {
      setMessage(`Recept '${recipe.machine}' wordt bewerkt.`, "info");
    }
  }

  function createIngredientFromInputs(sourceItem, sourceAmount) {
    const item = sourceItem.value.trim();
    const amount = Number.parseFloat(sourceAmount.value);
    if (!item) {
      setMessage("Voer een itemnaam in.", "error");
      return null;
    }
    if (Number.isNaN(amount) || amount <= 0) {
      setMessage("Hoeveelheid moet groter zijn dan nul.", "error");
      return null;
    }
    return { item, amount };
  }

  addInputButton.addEventListener("click", () => {
    const ingredient = createIngredientFromInputs(inputItem, inputAmount);
    if (!ingredient) {
      return;
    }
    currentInputs.push(ingredient);
    inputItem.value = "";
    inputAmount.value = "";
    renderIngredientList(inputList, currentInputs);
  });

  addOutputButton.addEventListener("click", () => {
    const ingredient = createIngredientFromInputs(outputItem, outputAmount);
    if (!ingredient) {
      return;
    }
    currentOutputs.push(ingredient);
    outputItem.value = "";
    outputAmount.value = "";
    renderIngredientList(outputList, currentOutputs);
  });

  function handleRecipeSubmit(event) {
    event.preventDefault();
    const id = recipeIdInput.value.trim();
    const machine = recipeMachineInput.value.trim();
    const tier = getTierValue();
    const eu = Number.parseFloat(recipeEuInput.value);
    const duration = Number.parseFloat(recipeDurationInput.value);

    if (!id || !machine || !tier) {
      setMessage("ID, machine en tier zijn verplicht.", "error");
      return;
    }
    const editingIndex =
      typeof state.editingIndex === "number" && !Number.isNaN(state.editingIndex)
        ? state.editingIndex
        : null;
    const duplicate = state.recipes.some((recipe, index) => {
      return recipe.id === id && index !== editingIndex;
    });
    if (duplicate) {
      setMessage(`Recept met ID '${id}' bestaat al.`, "error");
      return;
    }
    if (!currentOutputs.length) {
      setMessage("Voeg minstens één output toe.", "error");
      return;
    }
    if (Number.isNaN(eu) || eu <= 0 || Number.isNaN(duration) || duration <= 0) {
      setMessage("EU/t en duur moeten groter zijn dan nul.", "error");
      return;
    }

    const recipe = {
      id,
      machine,
      tier,
      coils: getCoilsValue() || null,
      heat: recipeHeatInput.value ? Number.parseInt(recipeHeatInput.value, 10) : null,
      eu_per_tick: eu,
      duration,
      inputs: currentInputs.map((entry) => ({ ...entry })),
      outputs: currentOutputs.map((entry) => ({ ...entry })),
    };

    if (editingIndex !== null && editingIndex >= 0 && editingIndex < state.recipes.length) {
      state.recipes.splice(editingIndex, 1, recipe);
      setMessage(`Recept '${recipe.machine}' bijgewerkt.`, "info");
    } else {
      state.recipes.push(recipe);
      setMessage(`Recept '${recipe.machine}' toegevoegd.`, "info");
    }
    renderRecipeTable();
    resetPlanViews();
    resetRecipeEditor();
  }

  function renderRecipeTable() {
    recipeTable.innerHTML = "";
    if (!state.recipes.length) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 8;
      cell.textContent = "Nog geen recepten toegevoegd.";
      row.appendChild(cell);
      recipeTable.appendChild(row);
      return;
    }

    state.recipes.forEach((recipe, index) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${recipe.id}</td>
        <td>${recipe.machine}</td>
        <td>${recipe.tier}</td>
        <td>${summariseIngredients(recipe.inputs)}</td>
        <td>${summariseIngredients(recipe.outputs)}</td>
        <td>${formatAmount(recipe.eu_per_tick)}</td>
        <td>${formatAmount(recipe.duration)}</td>
        <td>
          <div class="table-actions">
            <button class="ghost-button" data-action="edit" data-index="${index}">
              Bewerken
            </button>
            <button class="ghost-button" data-action="remove" data-index="${index}">
              Verwijderen
            </button>
          </div>
        </td>
      `;
      recipeTable.appendChild(row);
    });
  }

  function summariseIngredients(list) {
    if (!list.length) {
      return "-";
    }
    return list
      .map((entry) => `${formatAmount(entry.amount)} ${entry.item}`)
      .join("<br/>");
  }

  function removeRecipe(index) {
    state.recipes.splice(index, 1);
    if (typeof state.editingIndex === "number") {
      if (state.editingIndex === index) {
        resetRecipeEditor();
      } else if (state.editingIndex > index) {
        state.editingIndex -= 1;
        recipeIndexField.value = String(state.editingIndex);
      }
    }
    renderRecipeTable();
    resetPlanViews();
  }

  recipeTable.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) {
      return;
    }
    const index = Number.parseInt(button.dataset.index ?? "-1", 10);
    if (Number.isNaN(index)) {
      return;
    }
    const action = button.dataset.action;
    if (action === "edit") {
      startEditingRecipe(index);
    } else if (action === "remove") {
      removeRecipe(index);
    }
  });

  function handleTargetSubmit(event) {
    event.preventDefault();
    if (!state.recipes.length) {
      setMessage("Voeg eerst minimaal één recept toe.", "error");
      return;
    }
    const item = targetItemInput.value.trim();
    const amount = Number.parseFloat(targetAmountInput.value);
    if (!item || Number.isNaN(amount) || amount <= 0) {
      setMessage("Geef een geldig target item en hoeveelheid.", "error");
      return;
    }
    calculatePlan({ item, amount });
  }

  async function calculatePlan(target) {
    setMessage("Plan wordt berekend...", "info");
    try {
      const response = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_item: target.item,
          target_amount: target.amount,
          recipes: state.recipes,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        const message = data?.error?.message || "Plan kon niet worden berekend.";
        setMessage(message, "error");
        return;
      }

      currentNotes = data.notes || {};
      state.plan = data.plan || null;
      renderPlan(data);
      setMessage("Plan succesvol berekend.", "info");
    } catch (error) {
      console.error(error);
      setMessage("Er trad een fout op tijdens het berekenen.", "error");
    }
  }

  function renderPlan(response) {
    const definition = response.mermaid || "flowchart TD";
    mermaidSource.textContent = definition;
    renderMermaid(definition);
    renderMachineTable();
    renderEnergySummary();
    renderResources();
  }

  function resetPlanViews() {
    state.plan = null;
    currentNotes = {};
    mermaidSource.textContent = "";
    mermaidDiagram.textContent = "flowchart TD";
    renderMachineTable();
    renderEnergySummary();
    renderResources();
  }

  async function renderMermaid(definition) {
    if (!window.mermaid) {
      return;
    }
    const current = ++renderCounter;
    try {
      const { svg, bindFunctions } = await window.mermaid.render(
        `gtnh-plan-${current}`,
        definition
      );
      if (current !== renderCounter) {
        return;
      }
      mermaidDiagram.innerHTML = svg;
      if (typeof bindFunctions === "function") {
        bindFunctions(mermaidDiagram);
      }
    } catch (error) {
      console.error("Mermaid render error", error);
      setMessage("Mermaid kon het diagram niet tekenen.", "error");
    }
  }

  function renderMachineTable() {
    machineTable.innerHTML = "";
    const machines = state.plan?.machines ?? [];
    if (!machines.length) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 10;
      cell.textContent = "Nog geen plan berekend.";
      row.appendChild(cell);
      machineTable.appendChild(row);
      return;
    }

    machines.forEach((machine) => {
      const row = document.createElement("tr");
      const coilHeat = [machine.coils, machine.heat]
        .filter((value) => value !== null && value !== "")
        .map((value) => (typeof value === "number" ? `${value} K` : value))
        .join(" / ");
      row.innerHTML = `
        <td>${machine.machine}</td>
        <td>${machine.tier}</td>
        <td>${coilHeat || "-"}</td>
        <td>${formatAmount(machine.machines_required ?? machine.crafts)}</td>
        <td>${formatAmount(machine.duration)}</td>
        <td>${formatAmount(machine.active_seconds ?? machine.duration * machine.crafts)}</td>
        <td>${formatAmount(machine.eu_per_tick)}</td>
        <td>${formatAmount(machine.average_eu_per_tick ?? machine.eu_per_tick)}</td>
        <td>${formatAmount(machine.peak_eu_per_tick ?? machine.eu_per_tick)}</td>
        <td>${formatAmount(machine.eu_total)}</td>
      `;
      machineTable.appendChild(row);
    });
  }

  function renderEnergySummary() {
    energyTable.innerHTML = "";
    const energy = state.plan?.energy ?? null;
    energyAverageBox.textContent = formatOptional(energy?.average_eu_per_tick ?? null);
    energyPeakBox.textContent = formatOptional(energy?.peak_eu_per_tick ?? null);
    energyAverageAmpsBox.textContent = formatOptional(energy?.average_amperage ?? null);
    energyPeakAmpsBox.textContent = formatOptional(energy?.peak_amperage ?? null);

    const tiers = Array.isArray(energy?.tiers) ? energy.tiers : [];
    if (!tiers.length) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 7;
      cell.textContent = "Nog geen plan berekend.";
      row.appendChild(cell);
      energyTable.appendChild(row);
      return;
    }

    tiers.forEach((tier) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${tier.tier}</td>
        <td>${formatOptional(tier.voltage)}</td>
        <td>${formatAmount(tier.machines_required ?? 0)}</td>
        <td>${formatAmount(tier.average_eu_per_tick ?? 0)}</td>
        <td>${formatAmount(tier.peak_eu_per_tick ?? 0)}</td>
        <td>${formatOptional(tier.average_amperage)}</td>
        <td>${formatOptional(tier.peak_amperage)}</td>
      `;
      energyTable.appendChild(row);
    });
  }

  function renderResources() {
    const plan = state.plan;
    const rawItems = (plan?.raw_inputs || []).map((entry) => ({ ...entry, kind: "input" }));
    renderResourceList(rawList, rawItems, "Geen grondstoffen benodigd.");

    const outputItems = [];
    if (plan?.target) {
      outputItems.push({ ...plan.target, kind: "target" });
    }
    renderResourceList(producedList, outputItems, "Geen outputs.");

    const byproducts = (plan?.byproducts || []).map((entry) => ({ ...entry, kind: "byproduct" }));
    renderResourceList(byproductList, byproducts, "Geen bijproducten.");
  }

  function renderResourceList(container, items, emptyText) {
    container.innerHTML = "";
    if (!items.length) {
      const li = document.createElement("li");
      li.textContent = emptyText;
      container.appendChild(li);
      return;
    }
    items.forEach((entry) => {
      const li = document.createElement("li");
      li.innerHTML = `<strong>${entry.item}</strong><span>${formatAmount(entry.amount)}</span>`;
      if (entry.kind) {
        li.dataset.kind = entry.kind;
      }
      container.appendChild(li);
    });
  }

  function populateCatalogMachines() {
    const machineEntries = Object.values(state.catalogByMachine);
    machineEntries.sort((a, b) => a.name.localeCompare(b.name, "nl-NL"));

    catalogMachineSelect.innerHTML = "";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Kies een machine";
    catalogMachineSelect.appendChild(placeholder);

    machineEntries.forEach((entry) => {
      const option = document.createElement("option");
      option.value = entry.name;
      option.textContent = entry.name;
      catalogMachineSelect.appendChild(option);
    });

    catalogRecipeSelect.innerHTML = "";
    const recipePlaceholder = document.createElement("option");
    recipePlaceholder.value = "";
    recipePlaceholder.textContent = machineEntries.length
      ? "Kies een recept"
      : "Geen recepten beschikbaar";
    catalogRecipeSelect.appendChild(recipePlaceholder);
    catalogRecipeSelect.disabled = machineEntries.length === 0;
    catalogAddButton.disabled = true;

    if (!machineEntries.length) {
      catalogInfo.textContent = "Geen recepten in de catalogus beschikbaar.";
    } else {
      catalogInfo.textContent = "Kies een machine om de bijbehorende GregTech-recepten te bekijken.";
    }
  }

  function populateCatalogRecipes(machineName) {
    catalogRecipeSelect.innerHTML = "";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Kies een recept";
    catalogRecipeSelect.appendChild(placeholder);

    if (!machineName) {
      catalogRecipeSelect.disabled = true;
      catalogAddButton.disabled = true;
      catalogInfo.textContent = "Kies een machine om de bijbehorende GregTech-recepten te bekijken.";
      return;
    }

    const entry = state.catalogByMachine[machineName.toLowerCase()];
    if (!entry) {
      catalogRecipeSelect.disabled = true;
      catalogAddButton.disabled = true;
      catalogInfo.textContent = "Geen recepten gevonden voor deze machine.";
      return;
    }

    entry.recipes
      .slice()
      .sort((a, b) => a.id.localeCompare(b.id, "nl-NL"))
      .forEach((recipe) => {
        const option = document.createElement("option");
        const outputs = Array.isArray(recipe.outputs)
          ? recipe.outputs.map((out) => out.item).join(", ")
          : "";
        option.value = recipe.id;
        option.textContent = outputs ? `${recipe.id} – ${outputs}` : recipe.id;
        catalogRecipeSelect.appendChild(option);
      });

    catalogRecipeSelect.disabled = false;
    catalogAddButton.disabled = true;
    catalogInfo.textContent = "Selecteer een recept om details te zien.";
  }

  function findCatalogRecipe(machineName, recipeId) {
    if (!machineName || !recipeId) {
      return null;
    }
    const entry = state.catalogByMachine[machineName.toLowerCase()];
    if (!entry) {
      return null;
    }
    return entry.recipes.find((recipe) => recipe.id === recipeId) ?? null;
  }

  function updateCatalogInfo(recipe) {
    if (!recipe) {
      catalogInfo.textContent = "Selecteer een recept om details te zien.";
      return;
    }
    const eu = formatAmount(parseAmount(recipe.eu_per_tick ?? 0));
    const duration = formatAmount(parseAmount(recipe.duration ?? 0));
    const inputs = (recipe.inputs || [])
      .map((entry) => `${formatAmount(parseAmount(entry.amount))} ${entry.item}`)
      .join(", ");
    const outputs = (recipe.outputs || [])
      .map((entry) => `${formatAmount(parseAmount(entry.amount))} ${entry.item}`)
      .join(", ");
    catalogInfo.innerHTML = `
      <strong>${recipe.machine}</strong> – Tier ${recipe.tier}<br/>
      EU/t: ${eu} · Duur: ${duration} s<br/>
      <span>Inputs: ${inputs || "geen"}</span><br/>
      <span>Outputs: ${outputs || "geen"}</span>
    `;
  }

  async function loadCatalog() {
    try {
      const response = await fetch("/api/gregtech/recipes");
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      const recipes = Array.isArray(data?.recipes) ? data.recipes : [];
      state.catalog = recipes.map((entry) => ({
        ...entry,
        inputs: Array.isArray(entry.inputs) ? entry.inputs : [],
        outputs: Array.isArray(entry.outputs) ? entry.outputs : [],
      }));
      state.catalogByMachine = {};
      state.catalog.forEach((recipe) => {
        const name = recipe.machine || "Onbekende machine";
        const key = name.toLowerCase();
        if (!state.catalogByMachine[key]) {
          state.catalogByMachine[key] = { name, recipes: [] };
        }
        state.catalogByMachine[key].recipes.push(recipe);
      });
      populateCatalogMachines();
    } catch (error) {
      console.error("Kon GregTech catalogus niet laden", error);
      catalogInfo.textContent = "Kon GregTech-catalogus niet laden.";
      catalogMachineSelect.disabled = true;
      catalogRecipeSelect.disabled = true;
      catalogAddButton.disabled = true;
    }
  }

  function addCatalogRecipe() {
    const machineName = catalogMachineSelect.value;
    const recipeId = catalogRecipeSelect.value;
    const source = findCatalogRecipe(machineName, recipeId);
    if (!source) {
      setMessage("Selecteer een recept uit de catalogus.", "error");
      return;
    }

    const uniqueId = ensureUniqueRecipeId(source.id);
    const recipe = {
      id: uniqueId,
      machine: source.machine,
      tier: source.tier,
      coils: source.coils ?? null,
      heat:
        source.heat === undefined || source.heat === null
          ? null
          : Number.parseInt(source.heat, 10),
      eu_per_tick: parseAmount(source.eu_per_tick ?? 0),
      duration: parseAmount(source.duration ?? 0),
      inputs: (source.inputs || []).map((entry) => ({
        item: entry.item,
        amount: parseAmount(entry.amount ?? 0),
      })),
      outputs: (source.outputs || []).map((entry) => ({
        item: entry.item,
        amount: parseAmount(entry.amount ?? 0),
      })),
    };

    state.recipes.push(recipe);
    renderRecipeTable();
    resetPlanViews();
    startEditingRecipe(state.recipes.length - 1, { silent: true });
    setMessage(
      uniqueId === source.id
        ? `GregTech-recept '${source.id}' toegevoegd en klaar om te bewerken.`
        : `GregTech-recept '${source.id}' toegevoegd als '${uniqueId}' en klaar om te bewerken.`,
      "info"
    );
  }

  function exportData() {
    const payload = {
      target: {
        item: targetItemInput.value.trim(),
        amount: Number.parseFloat(targetAmountInput.value) || 0,
      },
      recipes: state.recipes,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const filename = `gtnh-plan-${Date.now()}.json`;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      URL.revokeObjectURL(link.href);
      link.remove();
    }, 0);
  }

  function importData(content) {
    try {
      const parsed = JSON.parse(content);
      if (!parsed || typeof parsed !== "object") {
        throw new Error("Ongeldige JSON");
      }
      const rawRecipes = Array.isArray(parsed.recipes) ? parsed.recipes : [];
      const normalised = rawRecipes.map(normaliseRecipe).filter(Boolean);
      state.recipes = normalised;
      renderRecipeTable();
      resetPlanViews();
      resetRecipeEditor();
      if (parsed.target) {
        targetItemInput.value = parsed.target.item ?? "";
        targetAmountInput.value = parseAmount(parsed.target.amount ?? 1);
      }
      const skipped = rawRecipes.length - normalised.length;
      const message = skipped > 0
        ? `Gegevens geïmporteerd (${normalised.length} recepten, ${skipped} overgeslagen).`
        : "Gegevens geïmporteerd.";
      setMessage(message, "info");
    } catch (error) {
      console.error(error);
      setMessage("Kon het bestand niet importeren.", "error");
    }
  }

  function loadSampleData() {
    const sample = {
      target: { item: "Toluene", amount: 50 },
      recipes: [
        {
          id: "heavy-oil-cracking",
          machine: "Distillation Tower",
          tier: "HV",
          coils: null,
          heat: null,
          eu_per_tick: 1920,
          duration: 24,
          inputs: [{ item: "Heavy Fuel", amount: 1000 }],
          outputs: [
            { item: "Light Fuel", amount: 350 },
            { item: "Naphtha", amount: 250 },
            { item: "Toluene", amount: 150 },
          ],
        },
        {
          id: "naphtha-split",
          machine: "Chemical Reactor",
          tier: "MV",
          coils: null,
          heat: null,
          eu_per_tick: 120,
          duration: 20,
          inputs: [
            { item: "Naphtha", amount: 100 },
            { item: "Hydrogen", amount: 100 },
          ],
          outputs: [
            { item: "Toluene", amount: 40 },
            { item: "Butadiene", amount: 30 },
          ],
        },
        {
          id: "hydrogen-electrolysis",
          machine: "Electrolyzer",
          tier: "LV",
          coils: null,
          heat: null,
          eu_per_tick: 30,
          duration: 20,
          inputs: [{ item: "Water", amount: 1000 }],
          outputs: [
            { item: "Hydrogen", amount: 200 },
            { item: "Oxygen", amount: 100 },
          ],
        },
      ],
    };
    state.recipes = sample.recipes.map((recipe) => normaliseRecipe(recipe)).filter(Boolean);
    renderRecipeTable();
    resetPlanViews();
    resetRecipeEditor();
    targetItemInput.value = sample.target.item;
    targetAmountInput.value = sample.target.amount;
    setMessage("Voorbeeld geladen.", "info");
  }

  recipeForm.addEventListener("submit", handleRecipeSubmit);
  targetForm.addEventListener("submit", handleTargetSubmit);
  recipeCancelButton.addEventListener("click", () => {
    const wasEditing = typeof state.editingIndex === "number";
    resetRecipeEditor();
    if (wasEditing) {
      setMessage("Bewerken geannuleerd.", "info");
    }
  });

  catalogMachineSelect.addEventListener("change", () => {
    populateCatalogRecipes(catalogMachineSelect.value);
  });

  catalogRecipeSelect.addEventListener("change", () => {
    const recipe = findCatalogRecipe(catalogMachineSelect.value, catalogRecipeSelect.value);
    catalogAddButton.disabled = !recipe;
    updateCatalogInfo(recipe);
  });

  catalogAddButton.addEventListener("click", addCatalogRecipe);

  importButton.addEventListener("click", () => importInput.click());
  exportButton.addEventListener("click", exportData);
  loadSample.addEventListener("click", loadSampleData);

  importInput.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      importData(String(reader.result));
      importInput.value = "";
    };
    reader.onerror = () => {
      setMessage("Fout bij het lezen van het bestand.", "error");
      importInput.value = "";
    };
    reader.readAsText(file);
  });

  loadCatalog();
  renderRecipeTable();
  renderIngredientList(inputList, currentInputs);
  renderIngredientList(outputList, currentOutputs);
  renderMachineTable();
  renderEnergySummary();
  renderResources();
})();
