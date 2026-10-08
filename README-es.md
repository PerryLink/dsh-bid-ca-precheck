# dsh-bid-ca-precheck — Verificación previa de la conformidad de la oferta frente a cada requisito del pliego

`dsh-bid-ca-precheck` lee un 投标符合性响应台账 —los requisitos del pliego y las respuestas del licitador, tomados con los propios nombres de columna del registro, en chino o en inglés—, aplica un paquete de reglas versionado y comprueba la completitud y la coherencia interna de ese registro: que cada requisito del pliego tenga una respuesta registrada, que el veredicto proceda del vocabulario que usted configure, que los números de cláusula sean únicos dentro del registro, que el registro declare su proyecto y su licitador, que una cláusula que usted marcó como de alto riesgo lleve evidencia y que la columna de requisitos contenga requisitos reales y no marcadores de plantilla.

## Qué responde

| Usted pregunta | Qué responde |
|---|---|
| La columna `response` de un requisito del pliego está vacía, ¿se informa de ello? | Sí. `BC-001` señala la fila, porque todo requisito del pliego debe tener una respuesta registrada. Solo comprueba que la columna `response` esté rellena: no juzga si la respuesta satisface el requisito, que es competencia de la comisión de evaluación. |
| Rellené la columna `verdict` y el informe dice que la regla no pudo ejecutarse. ¿Por qué? | `BC-002` compara cada valor con el vocabulario de veredictos que usted configure, y esa lista viene vacía, así que hasta que rellene `values` la regla se informa a sí misma en `skipped` en lugar de adivinar. Una vez configurada solo informa de un valor que no esté en su lista; nunca juzga si el veredicto es correcto. |
| El mismo número de cláusula aparece en dos filas del registro. | `BC-003` informa del valor `clause` repetido: si un número aparece dos veces, nadie puede decir qué fila responde a qué requisito. Se ignoran los espacios, así que `3.2` y ` 3.2 ` cuentan como el mismo número. Solo comprueba la unicidad; no decide cuál de las dos filas es la correcta: un hallazgo suele significar registro duplicado o un número copiado mal. |
| El registro no dice qué proyecto cubre ni quién es el licitador. | `BC-004` informa del campo de cabecera que falta y exige tanto `project` como `bidder`. Esa necesidad viene de la trazabilidad —un veredicto que no puede ligarse a un proyecto y a un licitador no se puede revisar después—, no de una cláusula que exija una cabecera en el registro. |
| ¿Qué filas deben llevar evidencia? | `BC-005`: toda fila cuyo texto de `requirement` contenga por inclusión una de sus palabras clave de alto riesgo. `highRiskKeywords` viene vacía, así que hasta que la rellene la regla se informa en `skipped` en lugar de pasar en silencio. Solo comprueba que la columna `evidence` esté rellena, no si la evidencia es válida o suficiente. |
| Algunas filas aún dicen 【……】 o `待填` en la columna de requisitos. | `BC-006` las informa: `【`, `】`, `{{`, `}}`, `XXX`, `待填`, `TBD` y términos parecidos que quedan en la columna `requirement` suelen indicar que el registro se copió de una plantilla y nunca se rellenó. La lista de términos es suya para ajustarla. La regla solo señala el marcador; no decide si el requisito en sí es real. |

## Normas que sigue

| Documento | Número | Reglas que lo citan |
|---|---|---|
| 《中华人民共和国招标投标法》 | 1999年8月30日通过，2017年12月27日修正（全国人大常委会《关于修改〈中华人民共和国招标投标法〉、〈中华人民共和国计量法〉的决定》），本法自2000年1月1日起施行 | BC-001, BC-003, BC-004, BC-006 |
| 《中华人民共和国招标投标法实施条例》 | 国务院令第613号（2011 年 12 月 20 日公布，2017 年 3 月 1 日修订，自 2012 年 2 月 1 日起施行） | BC-002 |
| 《中华人民共和国招标投标法》 | 1999年8月30日通过，2017年12月27日修正，自2000年1月1日起施行 | BC-005 |

**Boundary:** this plugin checks a **投标符合性响应台账** for what a register can be held to — that every
tender requirement has a recorded response, that verdicts come from your vocabulary and clause numbers are
unique, that a high-risk clause carries evidence, and that the requirement column still holds real
requirements rather than template placeholders. It does **not** decide whether a bid is valid, whether it
should be rejected, or whether a response is a material deviation. **Those calls belong to the evaluation
committee, and this plugin never makes them** — a test asserts that no rule here can be `error`.

> ### ⚠️ Read this before trusting a citation in the report
>
> **Every `excerpt` in this plugin's rule pack says, in so many words, that the clause text was not
> obtained.** The regime lives in 《招标投标法》, 《招标投标法实施条例》 and each project's 评标办法. The
> verification pass for this plugin could not retrieve verbatim clause text from them, so rather than
> paraphrase a quotation the pack states the gap in the `excerpt` field itself and puts the honest
> reasoning in `note`. Every rule is therefore `warn` or `info`, and a test asserts that no rule claims a
> quotation it does not have. **When the texts are in hand, two things must be done: replace each
> `excerpt` with the real clause, and raise `kind` to `direct`.**
>
> The worst failure mode of a register tool is a register copied from a template and mistaken for a
> checked one, so `BC-006` looks for exactly that: `【】`, `{{}}`, `XXX`, `待填`, `TBD` left in the
> requirement column.
>
> Two lists are yours, not a standard's: the verdict vocabulary (`BC-002`) and the high-risk keywords
> (`BC-005`). Both ship **empty**, and a rule whose list is unset reports itself in `skipped` rather than
> passing silently.

## Compatibility

| Superficie | Estado |
|---|---|
| Harness | Rango de peers `>=0.1.2-rc.1 <0.2.0 \|\| >=0.2.0-0 <0.3.0` — verificado para aceptar tanto `0.2.0-rc.2` como `0.2.1-alpha.1`. **No se declara `engines.dsh`**: no tiene lector y no puede rechazar ningún host |
| Node | `^22.19.0 || >=24.0.0` |
| Plataformas | Todas (ESM puro; sin código nativo, sin red, sin llamada al modelo) |
| Modo de herramienta | Funciona en `native`, `ptc` y `both`; para un directorio completo use `ptc` |

## What it does

La tabla de reglas, los campos y el comportamiento detallado están en [README.md](README.md#what-it-does) (versión principal en inglés). El plugin sólo enumera divergencias literales frente a las cláusulas citadas e indica en `skipped` cada comprobación que no pudo ejecutarse.

## Install

```sh
dsh plugin --profile <name> add dsh-bid-ca-precheck
dsh --profile <name> --dump-config | grep 'dsh-bid-ca-precheck'
```

## Configuration

Todos los parámetros ajustables viven en el esquema Schemastery de `src/config.ts`, por lo que se cambian desde `cordis.yml` sin tocar el código; los umbrales por regla están en el paquete de reglas bajo `rules/`.

| Clave | Tipo | Predeterminado | Descripción |
|---|---|---|---|
| `rulesFile` | string | `rules/bid-ca-precheck.yaml` | Ruta del paquete de reglas, relativa a la raíz del paquete |
| `disabledRules` | string[] | `[]` | Ids de reglas que se dejan de ejecutar; cada una aparece en `skipped` |
| `onlyRules` | string[] | `[]` | Ejecutar solo estas reglas; vacío ejecuta todas |
| `skipNotes` | string | `""` | Nota añadida a cada motivo de `skipped` |
| `timeoutMs` | number | `120000` | Presupuesto de tiempo de espera cooperativo de la herramienta |

## Material format

Acepta JSON o YAML. El ejemplo completo de campos está en [README.md](README.md#material-format) (versión principal en inglés). Los campos son opcionales en la capa de lectura y los valida el motor, de modo que una exportación parcial produce hallazgos sobre lo que falta en lugar de un fallo.

## Rule sources

Los datos de las reglas están separados del código: cada regla lleva documento, número, cláusula en la numeración propia de la fuente, extracto literal y URL de origen. El cargador impone que el extracto sea una cita real de al menos ocho caracteres y que una comprobación basada sólo en un principio general (`kind: derived-from-principle`, tope `warn`) o en una política local (`kind: institutional-configuration`, tope `info`) nunca se declare `error`.

Los límites verificados y las conclusiones deliberadamente **no** afirmadas están en [README.md](README.md#rule-sources) (versión principal en inglés) y en `rules/evidence/`.

## Troubleshooting

- **El plugin se instala pero la herramienta no aparece**: compruebe que `main` resuelve a `lib/index.mjs` y que `pnpm run build` lo generó.
- **`dsh plugin add` rechaza el paquete**: la faixa de peers cubre `0.1.x` y `0.2.x`; fuera de ella, conceda una exención explícita con `dsh plugin --profile <name> allow-version <pkg@ver> --dsh-version <runtime> --accept-risk`.
- **Una regla no se ejecutó**: lea el arreglo `skipped`.
- **`check` informa `manifest-peers` como fallo**: es un problema conocido de `dsh-plugin-dev`; el runtime aplica la compatibilidad al instalar.
- **Los horarios parecen desplazados**: toda la aritmética es de hora local sobre las cadenas entregadas.

## Development

```sh
pnpm install
pnpm run typecheck
pnpm test
pnpm run build
node ../scripts/sync-shared.mjs dsh-bid-ca-precheck
```

El último comando copia el kit compartido de `../_shared` a `src/shared/`; vuelva a ejecutarlo tras cada cambio compartido.

## License

[Apache License 2.0](LICENSE) © 2026 dsh-bid-ca-precheck contributors.
