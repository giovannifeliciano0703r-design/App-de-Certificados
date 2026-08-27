# Gerador de Certificados — distribuição

O projeto usa uma única interface e oferece três formatos:

- **Aplicativo instalável (PWA):** no navegador, use o botão “Instalar aplicativo”.
- **Windows:** o fluxo `Gerar aplicativos` do GitHub produz o instalador `.exe`.
- **Android:** o mesmo fluxo produz o arquivo `.apk`.

## Comandos locais

```bash
npm run desktop:dev
npm run desktop:build
npm run android:init
npm run android:build
```

Os aplicativos Windows e Android carregam a versão publicada do Gerador de Certificados, garantindo que melhorias futuras cheguem aos dispositivos sem reinstalação.
