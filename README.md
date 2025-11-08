# GTNH Flow Master

Een webtool om productiestromen voor **GregTech: New Horizons** visueel te bouwen zonder losse tekstbestanden of Python-scripts.

## Functies

- Interactieve editor voor nodes en verbindingen met ondersteuning voor notities, stijlen en richtingen.
- Automatische validatie van invoer via de server en live Mermaid-diagrammen in de browser.
- Import- en exportfunctionaliteit op basis van JSON zodat je flows eenvoudig kunt delen of versiebeheer kunt toepassen.
- Voorbeeldflow om snel te starten en eigen diagrammen op te bouwen.

## Vereisten

- Python 3.10 of hoger
- Virtuele omgeving (optioneel, maar aanbevolen)

## Installatie

```bash
pip install -r requirements.txt
```

## Applicatie starten

```bash
python app.py
```

De applicatie draait standaard op <http://localhost:8000>. Open deze URL in een browser om de editor te gebruiken. Zorg ervoor dat je internettoegang hebt zodat de Mermaid-bibliotheek via het CDN geladen kan worden.

## Gebruik

1. Vul de gewenste titel en oriëntatie in bij **Instellingen**.
2. Voeg nodes toe via het formulier. Met het optionele notitieveld kun je extra uitleg toevoegen die zichtbaar wordt bij een klik op de node.
3. Voeg verbindingen toe tussen nodes, kies eventueel een stijl en richting en geef labels mee voor extra context.
4. Het diagram wordt automatisch bijgewerkt. De Mermaid-broncode is beschikbaar onder het voorbeeld voor export naar andere tools.
5. Gebruik **Exporteren** om een JSON-bestand met de huidige flow op te slaan. Met **Importeren** laad je bestaande JSON-configuraties.
6. Druk op **Voorbeeld laden** om een demo-flow te bekijken.

## Ontwikkeling

- De serverlog toont validatiefouten en andere meldingen wanneer het genereren van het diagram niet lukt.
- Het backend gebruikt `pydantic` voor inputvalidatie. Aanpassingen aan de schema's kunnen in `app/flow_engine.py` worden gemaakt.
- Frontend functionaliteit staat in `app/static/js/app.js` en gebruikt vanilla JavaScript in combinatie met Mermaid.

## Licentie

MIT-licentie. Zie `LICENSE` (nog toe te voegen indien nodig).
