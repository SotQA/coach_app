import { I18n } from "i18n-js";
import en from "./en.json";
import pl from "./pl.json";
import ru from "./ru.json";

const i18n = new I18n({ en, pl, ru });

i18n.enableFallback = true;
i18n.defaultLocale = "en";

export { i18n };
