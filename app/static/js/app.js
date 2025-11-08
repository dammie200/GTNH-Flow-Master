(() => {
  const state = {
    title: "",
    orientation: "TD",
    nodes: [],
    edges: [],
  };

  const nodeTable = document.querySelector("#node-table");
  const edgeTable = document.querySelector("#edge-table");
  const nodeForm = document.querySelector("#node-form");
  const edgeForm = document.querySelector("#edge-form");
  const edgeSource = document.querySelector("#edge-source");
  const edgeTarget = document.querySelector("#edge-target");
  const edgeLabel = document.querySelector("#edge-label");
  const edgeStyle = document.querySelector("#edge-style");
  const edgeDirection = document.querySelector("#edge-direction");
  const flowTitle = document.querySelector("#flow-title");
  const flowOrientation = document.querySelector("#flow-orientation");
  const alertBox = document.querySelector("#alert-box");
  const mermaidSource = document.querySelector("#mermaid-source");
  const mermaidDiagram = document.querySelector("#mermaid-diagram");
  const importInput = document.querySelector("#import-input");
  const importButton = document.querySelector("#import-button");
  const exportButton = document.querySelector("#export-button");
  const sampleButton = document.querySelector("#load-sample");

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
      }, 8000);
    }
  }

  window.flowNote = (nodeId) => {
    const note = currentNotes[nodeId];
    if (!note) {
      return;
    }
    setMessage(note, "info");
  };

  function sanitiseKey(value) {
    return value.trim();
  }

  function updateEdgeOptions() {
    const options = state.nodes.map((node) => {
      const option = document.createElement("option");
      option.value = node.key;
      option.textContent = `${node.label} (${node.key})`;
      return option;
    });

    [edgeSource, edgeTarget].forEach((select) => {
      const prevValue = select.value;
      select.innerHTML = "";
      options.forEach((option) => select.appendChild(option.cloneNode(true)));
      if (options.length === 0) {
        const placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = "Geen nodes beschikbaar";
        select.appendChild(placeholder);
        select.disabled = true;
      } else {
        select.disabled = false;
        const exists = state.nodes.some((node) => node.key === prevValue);
        select.value = exists ? prevValue : state.nodes[0]?.key ?? "";
      }
    });
  }

  function renderNodeTable() {
    nodeTable.innerHTML = "";
    if (!state.nodes.length) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 4;
      cell.textContent = "Nog geen nodes toegevoegd";
      row.appendChild(cell);
      nodeTable.appendChild(row);
      return;
    }

    state.nodes.forEach((node) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${node.key}</td>
        <td>${node.label}</td>
        <td>${node.kind}</td>
        <td>
          <button class="action-button danger" data-action="remove" data-key="${node.key}">
            Verwijderen
          </button>
        </td>
      `;
      nodeTable.appendChild(row);
    });
  }

  function renderEdgeTable() {
    edgeTable.innerHTML = "";
    if (!state.edges.length) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 6;
      cell.textContent = "Nog geen verbindingen toegevoegd";
      row.appendChild(cell);
      edgeTable.appendChild(row);
      return;
    }

    state.edges.forEach((edge, index) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${edge.source}</td>
        <td>${edge.target}</td>
        <td>${edge.label || "-"}</td>
        <td>${edge.style}</td>
        <td>${edge.direction}</td>
        <td>
          <button class="action-button danger" data-action="remove-edge" data-index="${index}">
            Verwijderen
          </button>
        </td>
      `;
      edgeTable.appendChild(row);
    });
  }

  function sortNodes() {
    state.nodes.sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }));
  }

  function requestRender() {
    renderNodeTable();
    renderEdgeTable();
    updateEdgeOptions();
    generateMermaid();
  }

  async function generateMermaid() {
    const payload = {
      title: state.title,
      orientation: state.orientation,
      nodes: state.nodes,
      edges: state.edges,
    };

    try {
      const response = await fetch("/api/mermaid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        const message = data?.error?.message || "Ongeldige flowdefinitie.";
        setMessage(message, "error");
        return;
      }

      setMessage("");
      currentNotes = data.notes || {};
      const definition = data.mermaid || "flowchart TD";
      mermaidSource.textContent = definition;
      await renderMermaid(definition);
    } catch (error) {
      console.error(error);
      setMessage("Kon mermaid-diagram niet genereren. Controleer de server.", "error");
    }
  }

  async function renderMermaid(definition) {
    if (!window.mermaid) {
      return;
    }
    const current = ++renderCounter;
    try {
      const { svg, bindFunctions } = await window.mermaid.render(
        `gtnh-flow-${current}`,
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
      setMessage("Mermaid kon het diagram niet tekenen. Controleer de invoer.", "error");
    }
  }

  function handleNodeSubmit(event) {
    event.preventDefault();
    const key = sanitiseKey(nodeForm.key.value);
    const label = nodeForm.label.value.trim();
    const kind = nodeForm.kind.value;
    const note = nodeForm.note.value.trim();

    if (!key || !label) {
      setMessage("Key en label zijn verplicht.", "error");
      return;
    }

    if (state.nodes.some((node) => node.key === key)) {
      setMessage(`Er bestaat al een node met key '${key}'.`, "error");
      return;
    }

    state.nodes.push({ key, label, kind, note });
    sortNodes();
    nodeForm.reset();
    requestRender();
  }

  function handleEdgeSubmit(event) {
    event.preventDefault();
    if (!state.nodes.length) {
      setMessage("Voeg eerst nodes toe.", "error");
      return;
    }
    const source = edgeSource.value;
    const target = edgeTarget.value;

    if (!source || !target) {
      setMessage("Selecteer een bron en een doel.", "error");
      return;
    }

    if (source === target) {
      setMessage("Bron en doel moeten verschillend zijn.", "error");
      return;
    }

    const edge = {
      source,
      target,
      label: edgeLabel.value.trim(),
      style: edgeStyle.value,
      direction: edgeDirection.value,
    };

    state.edges.push(edge);
    edgeForm.reset();
    updateEdgeOptions();
    requestRender();
  }

  function removeNode(key) {
    const index = state.nodes.findIndex((node) => node.key === key);
    if (index === -1) {
      return;
    }
    state.nodes.splice(index, 1);
    state.edges = state.edges.filter((edge) => edge.source !== key && edge.target !== key);
    requestRender();
  }

  function removeEdge(index) {
    state.edges.splice(index, 1);
    requestRender();
  }

  function handleTableClick(event) {
    const button = event.target.closest("button[data-action]");
    if (!button) {
      return;
    }
    const action = button.dataset.action;
    if (action === "remove") {
      removeNode(button.dataset.key);
    } else if (action === "remove-edge") {
      const index = Number.parseInt(button.dataset.index ?? "-1", 10);
      if (!Number.isNaN(index)) {
        removeEdge(index);
      }
    }
  }

  function exportFlow() {
    const payload = {
      title: state.title,
      orientation: state.orientation,
      nodes: state.nodes,
      edges: state.edges,
    };
    const content = JSON.stringify(payload, null, 2);
    const blob = new Blob([content], { type: "application/json" });
    const filename = `${(state.title || "gtnh-flow").replace(/\s+/g, "-").toLowerCase()}.json`;
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

  function importFlow(content) {
    try {
      const parsed = JSON.parse(content);
      if (!parsed || typeof parsed !== "object") {
        throw new Error("Ongeldige JSON");
      }
      state.title = parsed.title ?? "";
      state.orientation = parsed.orientation ?? "TD";
      state.nodes = Array.isArray(parsed.nodes) ? parsed.nodes : [];
      state.edges = Array.isArray(parsed.edges) ? parsed.edges : [];
      flowTitle.value = state.title;
      flowOrientation.value = state.orientation;
      requestRender();
      setMessage("Flow succesvol geïmporteerd.", "info");
    } catch (error) {
      console.error(error);
      setMessage("Kon het bestand niet importeren.", "error");
    }
  }

  function loadSample() {
    const sample = {
      title: "Bronze Blast Furnace",
      orientation: "LR",
      nodes: [
        {
          key: "start",
          label: "Start",
          kind: "terminator",
          note: "Begin van de productie.",
        },
        {
          key: "steam",
          label: "Steam Compressor",
          kind: "process",
          note: "Maakt compressed air voor de furnace.",
        },
        {
          key: "bf",
          label: "Bronze Blast Furnace",
          kind: "process",
          note: "Smelt ijzererts naar gesmolten ijzer.",
        },
        {
          key: "ingot",
          label: "Iron Ingot",
          kind: "output",
          note: "Resultaat voor verdere verwerking.",
        },
        {
          key: "slag",
          label: "Slag",
          kind: "data",
          note: "Bijproduct voor recycling.",
        },
      ],
      edges: [
        { source: "start", target: "steam", label: "Start machine" },
        { source: "steam", target: "bf", label: "Compressed Air" },
        { source: "bf", target: "ingot", label: "Liquid Iron" },
        { source: "bf", target: "slag", style: "dashed", direction: "none", label: "Slag" },
      ],
    };
    state.title = sample.title;
    state.orientation = sample.orientation;
    state.nodes = sample.nodes;
    state.edges = sample.edges;
    flowTitle.value = state.title;
    flowOrientation.value = state.orientation;
    requestRender();
    setMessage("Voorbeeld geladen.", "info");
  }

  nodeForm.addEventListener("submit", handleNodeSubmit);
  edgeForm.addEventListener("submit", handleEdgeSubmit);
  nodeTable.addEventListener("click", handleTableClick);
  edgeTable.addEventListener("click", handleTableClick);

  flowTitle.addEventListener("input", (event) => {
    state.title = event.target.value;
  });

  flowOrientation.addEventListener("change", (event) => {
    state.orientation = event.target.value;
    requestRender();
  });

  importButton.addEventListener("click", () => importInput.click());
  exportButton.addEventListener("click", exportFlow);
  sampleButton.addEventListener("click", loadSample);

  importInput.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      importFlow(String(reader.result));
      importInput.value = "";
    };
    reader.onerror = () => {
      setMessage("Fout bij het lezen van het bestand.", "error");
      importInput.value = "";
    };
    reader.readAsText(file);
  });

  // Initiële toestand
  renderNodeTable();
  renderEdgeTable();
  updateEdgeOptions();
  generateMermaid();
})();
