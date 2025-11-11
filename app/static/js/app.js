(() => {
  const state = {
    recipes: [],
    plan: null,
  };

  const recipeForm = document.querySelector("#recipe-form");
  const targetForm = document.querySelector("#target-form");
  const recipeTable = document.querySelector("#recipe-table");
  const machineTable = document.querySelector("#machine-table");
  const rawList = document.querySelector("#raw-list");
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

  const inputItem = document.querySelector("#input-item");
  const inputAmount = document.querySelector("#input-amount");
  const addInputButton = document.querySelector("#add-input");
  const inputList = document.querySelector("#input-list");

  const outputItem = document.querySelector("#output-item");
  const outputAmount = document.querySelector("#output-amount");
  const addOutputButton = document.querySelector("#add-output");
  const outputList = document.querySelector("#output-list");

  let currentInputs = [];
  let currentOutputs = [];
  let messageTimeout;
  let currentNotes = {};
  let renderCounter = 0;

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
    const formData = new FormData(recipeForm);
    const id = formData.get("id").trim();
    const machine = formData.get("machine").trim();
    const tier = formData.get("tier").trim();
    const eu = Number.parseFloat(formData.get("eu_per_tick"));
    const duration = Number.parseFloat(formData.get("duration"));

    if (!id || !machine || !tier) {
      setMessage("ID, machine en tier zijn verplicht.", "error");
      return;
    }
    if (state.recipes.some((recipe) => recipe.id === id)) {
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
      coils: formData.get("coils")?.toString().trim() || null,
      heat: formData.get("heat") ? Number.parseInt(formData.get("heat"), 10) : null,
      eu_per_tick: eu,
      duration,
      inputs: currentInputs.map((entry) => ({ ...entry })),
      outputs: currentOutputs.map((entry) => ({ ...entry })),
    };

    state.recipes.push(recipe);
    renderRecipeTable();
    recipeForm.reset();
    resetIngredientLists();
    setMessage(`Recept '${recipe.machine}' toegevoegd.`, "info");
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
          <button class="ghost-button" data-action="remove" data-index="${index}">
            Verwijderen
          </button>
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
    renderRecipeTable();
  }

  recipeTable.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) {
      return;
    }
    const index = Number.parseInt(button.dataset.index ?? "-1", 10);
    if (!Number.isNaN(index)) {
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
      cell.colSpan = 7;
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
        <td>${formatAmount(machine.crafts)}</td>
        <td>${formatAmount(machine.eu_per_tick)}</td>
        <td>${formatAmount(machine.duration)}</td>
        <td>${formatAmount(machine.eu_total)}</td>
      `;
      machineTable.appendChild(row);
    });
  }

  function renderResources() {
    renderResourceList(rawList, state.plan?.raw_inputs || [], "Geen grondstoffen benodigd.");
    renderResourceList(
      byproductList,
      state.plan?.byproducts || [],
      "Geen bijproducten."
    );
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
      container.appendChild(li);
    });
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
      state.recipes = Array.isArray(parsed.recipes) ? parsed.recipes : [];
      renderRecipeTable();
      resetIngredientLists();
      if (parsed.target) {
        targetItemInput.value = parsed.target.item ?? "";
        targetAmountInput.value = parsed.target.amount ?? 1;
      }
      setMessage("Gegevens geïmporteerd.", "info");
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
          duration: 480,
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
          duration: 400,
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
          duration: 400,
          inputs: [{ item: "Water", amount: 1000 }],
          outputs: [
            { item: "Hydrogen", amount: 200 },
            { item: "Oxygen", amount: 100 },
          ],
        },
      ],
    };
    state.recipes = sample.recipes;
    renderRecipeTable();
    resetIngredientLists();
    targetItemInput.value = sample.target.item;
    targetAmountInput.value = sample.target.amount;
    setMessage("Voorbeeld geladen.", "info");
  }

  recipeForm.addEventListener("submit", handleRecipeSubmit);
  targetForm.addEventListener("submit", handleTargetSubmit);

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

  renderRecipeTable();
  renderIngredientList(inputList, currentInputs);
  renderIngredientList(outputList, currentOutputs);
  renderMachineTable();
  renderResources();
})();
