# GTNH Flow Master

Een webtool om volledige productieketens voor **GregTech: New Horizons** te plannen. Geef je target item op, vul de recepten van je machines in en ontvang direct de benodigde aantallen, energieverbruik en een automatisch gegenereerd flowdiagram.

## Functies

- Voer machinegegevens in inclusief tier, coils/heat, EU/t, duur en item input/output hoeveelheden.
- Bepaal een target (bijvoorbeeld 50 Toluene) en laat de tool de volledige keten en grondstoffen berekenen.
- Automatische weergave van Mermaid-diagrammen met notities per machine en klikbare details.
- Overzichten voor machines, grondstoffen en bijproducten zodat je exact weet wat je nodig hebt.
- Import/export van plannen als JSON en een voorgeconfigureerd voorbeeld om snel te starten.

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

1. Vul je target item en gewenste hoeveelheid in bovenaan de pagina.
2. Voeg voor elke machine in de keten een recept toe met inputs, outputs, tier, coils/heat en energiegegevens.
3. Klik op **Bereken plan** om automatisch alle benodigde machines, grondstoffen en bijproducten te laten uitrekenen.
4. Bekijk het diagram, het machineoverzicht en de grondstoffenlijsten voor exacte aantallen en energie.
5. Gebruik import/export om plannen als JSON op te slaan of te delen. Met **Voorbeeld laden** verschijnt een voorbeeldplanning rond Toluene.

## Ontwikkeling

- `app/production_engine.py` bevat de logica om recepten te valideren en een productieplan op te bouwen.
- `app/flow_engine.py` genereert de Mermaid-diagrammen op basis van het plan.
- Frontend functionaliteit staat in `app/static/js/app.js` en gebruikt vanilla JavaScript in combinatie met Mermaid.

## Licentie

MIT-licentie. Zie `LICENSE` (nog toe te voegen indien nodig).
