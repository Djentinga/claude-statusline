process.env.FORCE_COLOR='1';import{createRequire}from'module';const require=createRequire(import.meta.url);

// src/command.ts
import fs2 from "node:fs";
import { spawn } from "node:child_process";
import path3 from "node:path";
import { fileURLToPath } from "node:url";

// src/lib/cache.ts
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
var CACHE_PATH = path.join(os.homedir(), ".claude", ".statusline-cache.json");
var CACHE_TTL = 120;
var STALE_THRESHOLD = 2 * CACHE_TTL;
function readCache() {
  try {
    return JSON.parse(fs.readFileSync(CACHE_PATH, "utf-8"));
  } catch {
    return null;
  }
}
function isCacheStale(cache2) {
  if (!cache2) return true;
  return Date.now() / 1e3 - cache2.ts > CACHE_TTL;
}
function isCacheVeryStale(cache2) {
  if (!cache2?.ts) return true;
  return Date.now() / 1e3 - cache2.ts > STALE_THRESHOLD;
}

// node_modules/chalk/source/vendor/ansi-styles/index.js
var ANSI_BACKGROUND_OFFSET = 10;
var wrapAnsi16 = (offset = 0) => (code) => `\x1B[${code + offset}m`;
var wrapAnsi256 = (offset = 0) => (code) => `\x1B[${38 + offset};5;${code}m`;
var wrapAnsi16m = (offset = 0) => (red, green, blue) => `\x1B[${38 + offset};2;${red};${green};${blue}m`;
var styles = {
  modifier: {
    reset: [0, 0],
    // 21 isn't widely supported and 22 does the same thing
    bold: [1, 22],
    dim: [2, 22],
    italic: [3, 23],
    underline: [4, 24],
    overline: [53, 55],
    inverse: [7, 27],
    hidden: [8, 28],
    strikethrough: [9, 29]
  },
  color: {
    black: [30, 39],
    red: [31, 39],
    green: [32, 39],
    yellow: [33, 39],
    blue: [34, 39],
    magenta: [35, 39],
    cyan: [36, 39],
    white: [37, 39],
    // Bright color
    blackBright: [90, 39],
    gray: [90, 39],
    // Alias of `blackBright`
    grey: [90, 39],
    // Alias of `blackBright`
    redBright: [91, 39],
    greenBright: [92, 39],
    yellowBright: [93, 39],
    blueBright: [94, 39],
    magentaBright: [95, 39],
    cyanBright: [96, 39],
    whiteBright: [97, 39]
  },
  bgColor: {
    bgBlack: [40, 49],
    bgRed: [41, 49],
    bgGreen: [42, 49],
    bgYellow: [43, 49],
    bgBlue: [44, 49],
    bgMagenta: [45, 49],
    bgCyan: [46, 49],
    bgWhite: [47, 49],
    // Bright color
    bgBlackBright: [100, 49],
    bgGray: [100, 49],
    // Alias of `bgBlackBright`
    bgGrey: [100, 49],
    // Alias of `bgBlackBright`
    bgRedBright: [101, 49],
    bgGreenBright: [102, 49],
    bgYellowBright: [103, 49],
    bgBlueBright: [104, 49],
    bgMagentaBright: [105, 49],
    bgCyanBright: [106, 49],
    bgWhiteBright: [107, 49]
  }
};
var modifierNames = Object.keys(styles.modifier);
var foregroundColorNames = Object.keys(styles.color);
var backgroundColorNames = Object.keys(styles.bgColor);
var colorNames = [...foregroundColorNames, ...backgroundColorNames];
function assembleStyles() {
  const codes = /* @__PURE__ */ new Map();
  for (const [groupName, group] of Object.entries(styles)) {
    for (const [styleName, style] of Object.entries(group)) {
      styles[styleName] = {
        open: `\x1B[${style[0]}m`,
        close: `\x1B[${style[1]}m`
      };
      group[styleName] = styles[styleName];
      codes.set(style[0], style[1]);
    }
    Object.defineProperty(styles, groupName, {
      value: group,
      enumerable: false
    });
  }
  Object.defineProperty(styles, "codes", {
    value: codes,
    enumerable: false
  });
  styles.color.close = "\x1B[39m";
  styles.bgColor.close = "\x1B[49m";
  styles.color.ansi = wrapAnsi16();
  styles.color.ansi256 = wrapAnsi256();
  styles.color.ansi16m = wrapAnsi16m();
  styles.bgColor.ansi = wrapAnsi16(ANSI_BACKGROUND_OFFSET);
  styles.bgColor.ansi256 = wrapAnsi256(ANSI_BACKGROUND_OFFSET);
  styles.bgColor.ansi16m = wrapAnsi16m(ANSI_BACKGROUND_OFFSET);
  Object.defineProperties(styles, {
    rgbToAnsi256: {
      value(red, green, blue) {
        if (red === green && green === blue) {
          if (red < 8) {
            return 16;
          }
          if (red > 248) {
            return 231;
          }
          return Math.round((red - 8) / 247 * 24) + 232;
        }
        return 16 + 36 * Math.round(red / 255 * 5) + 6 * Math.round(green / 255 * 5) + Math.round(blue / 255 * 5);
      },
      enumerable: false
    },
    hexToRgb: {
      value(hex) {
        const matches = /[a-f\d]{6}|[a-f\d]{3}/i.exec(hex.toString(16));
        if (!matches) {
          return [0, 0, 0];
        }
        let [colorString] = matches;
        if (colorString.length === 3) {
          colorString = [...colorString].map((character) => character + character).join("");
        }
        const integer = Number.parseInt(colorString, 16);
        return [
          /* eslint-disable no-bitwise */
          integer >> 16 & 255,
          integer >> 8 & 255,
          integer & 255
          /* eslint-enable no-bitwise */
        ];
      },
      enumerable: false
    },
    hexToAnsi256: {
      value: (hex) => styles.rgbToAnsi256(...styles.hexToRgb(hex)),
      enumerable: false
    },
    ansi256ToAnsi: {
      value(code) {
        if (code < 8) {
          return 30 + code;
        }
        if (code < 16) {
          return 90 + (code - 8);
        }
        let red;
        let green;
        let blue;
        if (code >= 232) {
          red = ((code - 232) * 10 + 8) / 255;
          green = red;
          blue = red;
        } else {
          code -= 16;
          const remainder = code % 36;
          red = Math.floor(code / 36) / 5;
          green = Math.floor(remainder / 6) / 5;
          blue = remainder % 6 / 5;
        }
        const value = Math.max(red, green, blue) * 2;
        if (value === 0) {
          return 30;
        }
        let result = 30 + (Math.round(blue) << 2 | Math.round(green) << 1 | Math.round(red));
        if (value === 2) {
          result += 60;
        }
        return result;
      },
      enumerable: false
    },
    rgbToAnsi: {
      value: (red, green, blue) => styles.ansi256ToAnsi(styles.rgbToAnsi256(red, green, blue)),
      enumerable: false
    },
    hexToAnsi: {
      value: (hex) => styles.ansi256ToAnsi(styles.hexToAnsi256(hex)),
      enumerable: false
    }
  });
  return styles;
}
var ansiStyles = assembleStyles();
var ansi_styles_default = ansiStyles;

// node_modules/chalk/source/vendor/supports-color/index.js
import process2 from "node:process";
import os2 from "node:os";
import tty from "node:tty";
function hasFlag(flag, argv = globalThis.Deno ? globalThis.Deno.args : process2.argv) {
  const prefix = flag.startsWith("-") ? "" : flag.length === 1 ? "-" : "--";
  const position = argv.indexOf(prefix + flag);
  const terminatorPosition = argv.indexOf("--");
  return position !== -1 && (terminatorPosition === -1 || position < terminatorPosition);
}
var { env } = process2;
var flagForceColor;
if (hasFlag("no-color") || hasFlag("no-colors") || hasFlag("color=false") || hasFlag("color=never")) {
  flagForceColor = 0;
} else if (hasFlag("color") || hasFlag("colors") || hasFlag("color=true") || hasFlag("color=always")) {
  flagForceColor = 1;
}
function envForceColor() {
  if ("FORCE_COLOR" in env) {
    if (env.FORCE_COLOR === "true") {
      return 1;
    }
    if (env.FORCE_COLOR === "false") {
      return 0;
    }
    return env.FORCE_COLOR.length === 0 ? 1 : Math.min(Number.parseInt(env.FORCE_COLOR, 10), 3);
  }
}
function translateLevel(level) {
  if (level === 0) {
    return false;
  }
  return {
    level,
    hasBasic: true,
    has256: level >= 2,
    has16m: level >= 3
  };
}
function _supportsColor(haveStream, { streamIsTTY, sniffFlags = true } = {}) {
  const noFlagForceColor = envForceColor();
  if (noFlagForceColor !== void 0) {
    flagForceColor = noFlagForceColor;
  }
  const forceColor = sniffFlags ? flagForceColor : noFlagForceColor;
  if (forceColor === 0) {
    return 0;
  }
  if (sniffFlags) {
    if (hasFlag("color=16m") || hasFlag("color=full") || hasFlag("color=truecolor")) {
      return 3;
    }
    if (hasFlag("color=256")) {
      return 2;
    }
  }
  if ("TF_BUILD" in env && "AGENT_NAME" in env) {
    return 1;
  }
  if (haveStream && !streamIsTTY && forceColor === void 0) {
    return 0;
  }
  const min = forceColor || 0;
  if (env.TERM === "dumb") {
    return min;
  }
  if (process2.platform === "win32") {
    const osRelease = os2.release().split(".");
    if (Number(osRelease[0]) >= 10 && Number(osRelease[2]) >= 10586) {
      return Number(osRelease[2]) >= 14931 ? 3 : 2;
    }
    return 1;
  }
  if ("CI" in env) {
    if (["GITHUB_ACTIONS", "GITEA_ACTIONS", "CIRCLECI"].some((key) => key in env)) {
      return 3;
    }
    if (["TRAVIS", "APPVEYOR", "GITLAB_CI", "BUILDKITE", "DRONE"].some((sign) => sign in env) || env.CI_NAME === "codeship") {
      return 1;
    }
    return min;
  }
  if ("TEAMCITY_VERSION" in env) {
    return /^(9\.(0*[1-9]\d*)\.|\d{2,}\.)/.test(env.TEAMCITY_VERSION) ? 1 : 0;
  }
  if (env.COLORTERM === "truecolor") {
    return 3;
  }
  if (env.TERM === "xterm-kitty") {
    return 3;
  }
  if (env.TERM === "xterm-ghostty") {
    return 3;
  }
  if (env.TERM === "wezterm") {
    return 3;
  }
  if ("TERM_PROGRAM" in env) {
    const version = Number.parseInt((env.TERM_PROGRAM_VERSION || "").split(".")[0], 10);
    switch (env.TERM_PROGRAM) {
      case "iTerm.app": {
        return version >= 3 ? 3 : 2;
      }
      case "Apple_Terminal": {
        return 2;
      }
    }
  }
  if (/-256(color)?$/i.test(env.TERM)) {
    return 2;
  }
  if (/^screen|^xterm|^vt100|^vt220|^rxvt|color|ansi|cygwin|linux/i.test(env.TERM)) {
    return 1;
  }
  if ("COLORTERM" in env) {
    return 1;
  }
  return min;
}
function createSupportsColor(stream, options = {}) {
  const level = _supportsColor(stream, {
    streamIsTTY: stream && stream.isTTY,
    ...options
  });
  return translateLevel(level);
}
var supportsColor = {
  stdout: createSupportsColor({ isTTY: tty.isatty(1) }),
  stderr: createSupportsColor({ isTTY: tty.isatty(2) })
};
var supports_color_default = supportsColor;

// node_modules/chalk/source/utilities.js
function stringReplaceAll(string, substring, replacer) {
  let index = string.indexOf(substring);
  if (index === -1) {
    return string;
  }
  const substringLength = substring.length;
  let endIndex = 0;
  let returnValue = "";
  do {
    returnValue += string.slice(endIndex, index) + substring + replacer;
    endIndex = index + substringLength;
    index = string.indexOf(substring, endIndex);
  } while (index !== -1);
  returnValue += string.slice(endIndex);
  return returnValue;
}
function stringEncaseCRLFWithFirstIndex(string, prefix, postfix, index) {
  let endIndex = 0;
  let returnValue = "";
  do {
    const gotCR = string[index - 1] === "\r";
    returnValue += string.slice(endIndex, gotCR ? index - 1 : index) + prefix + (gotCR ? "\r\n" : "\n") + postfix;
    endIndex = index + 1;
    index = string.indexOf("\n", endIndex);
  } while (index !== -1);
  returnValue += string.slice(endIndex);
  return returnValue;
}

// node_modules/chalk/source/index.js
var { stdout: stdoutColor, stderr: stderrColor } = supports_color_default;
var GENERATOR = Symbol("GENERATOR");
var STYLER = Symbol("STYLER");
var IS_EMPTY = Symbol("IS_EMPTY");
var levelMapping = [
  "ansi",
  "ansi",
  "ansi256",
  "ansi16m"
];
var styles2 = /* @__PURE__ */ Object.create(null);
var applyOptions = (object, options = {}) => {
  if (options.level && !(Number.isInteger(options.level) && options.level >= 0 && options.level <= 3)) {
    throw new Error("The `level` option should be an integer from 0 to 3");
  }
  const colorLevel = stdoutColor ? stdoutColor.level : 0;
  object.level = options.level === void 0 ? colorLevel : options.level;
};
var chalkFactory = (options) => {
  const chalk2 = (...strings) => strings.join(" ");
  applyOptions(chalk2, options);
  Object.setPrototypeOf(chalk2, createChalk.prototype);
  return chalk2;
};
function createChalk(options) {
  return chalkFactory(options);
}
Object.setPrototypeOf(createChalk.prototype, Function.prototype);
for (const [styleName, style] of Object.entries(ansi_styles_default)) {
  styles2[styleName] = {
    get() {
      const builder = createBuilder(this, createStyler(style.open, style.close, this[STYLER]), this[IS_EMPTY]);
      Object.defineProperty(this, styleName, { value: builder });
      return builder;
    }
  };
}
styles2.visible = {
  get() {
    const builder = createBuilder(this, this[STYLER], true);
    Object.defineProperty(this, "visible", { value: builder });
    return builder;
  }
};
var getModelAnsi = (model2, level, type, ...arguments_) => {
  if (model2 === "rgb") {
    if (level === "ansi16m") {
      return ansi_styles_default[type].ansi16m(...arguments_);
    }
    if (level === "ansi256") {
      return ansi_styles_default[type].ansi256(ansi_styles_default.rgbToAnsi256(...arguments_));
    }
    return ansi_styles_default[type].ansi(ansi_styles_default.rgbToAnsi(...arguments_));
  }
  if (model2 === "hex") {
    return getModelAnsi("rgb", level, type, ...ansi_styles_default.hexToRgb(...arguments_));
  }
  return ansi_styles_default[type][model2](...arguments_);
};
var usedModels = ["rgb", "hex", "ansi256"];
for (const model2 of usedModels) {
  styles2[model2] = {
    get() {
      const { level } = this;
      return function(...arguments_) {
        const styler = createStyler(getModelAnsi(model2, levelMapping[level], "color", ...arguments_), ansi_styles_default.color.close, this[STYLER]);
        return createBuilder(this, styler, this[IS_EMPTY]);
      };
    }
  };
  const bgModel = "bg" + model2[0].toUpperCase() + model2.slice(1);
  styles2[bgModel] = {
    get() {
      const { level } = this;
      return function(...arguments_) {
        const styler = createStyler(getModelAnsi(model2, levelMapping[level], "bgColor", ...arguments_), ansi_styles_default.bgColor.close, this[STYLER]);
        return createBuilder(this, styler, this[IS_EMPTY]);
      };
    }
  };
}
var proto = Object.defineProperties(() => {
}, {
  ...styles2,
  level: {
    enumerable: true,
    get() {
      return this[GENERATOR].level;
    },
    set(level) {
      this[GENERATOR].level = level;
    }
  }
});
var createStyler = (open, close, parent) => {
  let openAll;
  let closeAll;
  if (parent === void 0) {
    openAll = open;
    closeAll = close;
  } else {
    openAll = parent.openAll + open;
    closeAll = close + parent.closeAll;
  }
  return {
    open,
    close,
    openAll,
    closeAll,
    parent
  };
};
var createBuilder = (self, _styler, _isEmpty) => {
  const builder = (...arguments_) => applyStyle(builder, arguments_.length === 1 ? "" + arguments_[0] : arguments_.join(" "));
  Object.setPrototypeOf(builder, proto);
  builder[GENERATOR] = self;
  builder[STYLER] = _styler;
  builder[IS_EMPTY] = _isEmpty;
  return builder;
};
var applyStyle = (self, string) => {
  if (self.level <= 0 || !string) {
    return self[IS_EMPTY] ? "" : string;
  }
  let styler = self[STYLER];
  if (styler === void 0) {
    return string;
  }
  const { openAll, closeAll } = styler;
  if (string.includes("\x1B")) {
    while (styler !== void 0) {
      string = stringReplaceAll(string, styler.close, styler.open);
      styler = styler.parent;
    }
  }
  const lfIndex = string.indexOf("\n");
  if (lfIndex !== -1) {
    string = stringEncaseCRLFWithFirstIndex(string, closeAll, openAll, lfIndex);
  }
  return openAll + string + closeAll;
};
Object.defineProperties(createChalk.prototype, styles2);
var chalk = createChalk();
var chalkStderr = createChalk({ level: stderrColor ? stderrColor.level : 0 });
var source_default = chalk;

// src/lib/format.ts
var COMPACT_AT = 166e3;
var BAR_W = 8;
function formatTokens(tokens) {
  if (tokens < 1e3) return String(tokens);
  return Math.floor(tokens / 1e3) + "k";
}
function calcExpected(resetsAt, windowSecs, daily = false) {
  if (!resetsAt) return null;
  try {
    const resets = new Date(resetsAt).getTime();
    const now = Date.now();
    const elapsed = windowSecs - (resets - now) / 1e3;
    if (daily) {
      const daysElapsed = Math.ceil(Math.max(0, elapsed) / 86400);
      const totalDays = Math.round(windowSecs / 86400);
      return Math.max(0, Math.min(daysElapsed / totalDays * 100, 100));
    }
    return Math.max(0, Math.min(elapsed / windowSecs * 100, 100));
  } catch {
    return null;
  }
}
function resetTimeLocal(resetsAt) {
  if (!resetsAt) return "";
  try {
    const d = new Date(resetsAt);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  } catch {
    return "";
  }
}

// src/lib/git.ts
import { execSync } from "node:child_process";
import path2 from "node:path";
function getGitInfo() {
  try {
    const branch = execSync("git rev-parse --abbrev-ref HEAD", {
      timeout: 1e3,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"]
    }).trim();
    const toplevel = execSync("git rev-parse --show-toplevel", {
      timeout: 1e3,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"]
    }).trim();
    const repo = path2.basename(toplevel);
    return `${repo}:${branch}`;
  } catch {
    return "";
  }
}

// src/components/Bar.ts
function ctxColor(val) {
  if (val < 50) return "green";
  if (val < 75) return "yellow";
  if (val < 90) return "red";
  return "redBright";
}
function budgetColor(actual, expected) {
  if (expected === null) {
    if (actual < 50) return "green";
    if (actual < 75) return "yellow";
    if (actual < 90) return "red";
    return "redBright";
  }
  const over = actual - expected;
  if (over <= 0) return "green";
  if (over <= 10) return "yellow";
  if (over <= 25) return "red";
  return "redBright";
}
function bar(value, color, cutoff, width = BAR_W) {
  const clamped = Math.max(0, Math.min(value, 100));
  const filled = Math.round(clamped * width / 100);
  const mpos = cutoff != null ? Math.max(0, Math.min(Math.round(Math.max(0, Math.min(cutoff, 100)) * width / 100), width - 1)) : -1;
  const chars = [];
  for (let i = 0; i < width; i++) {
    if (i === mpos) {
      chars.push(i < filled ? "\u2592" : "\u2593");
    } else if (i < filled) {
      chars.push("\u2588");
    } else {
      chars.push("\u2591");
    }
  }
  return source_default[color](chars.join(""));
}

// src/components/ServiceBadge.ts
function serviceBadge(name, up) {
  return up ? source_default.green(`\u25A3 ${name}`) : source_default.dim(`\u25A3 ${name}`);
}

// src/components/UsageDisplay.ts
var WINDOW_5H = 5 * 3600;
var WINDOW_7D = 7 * 24 * 3600;
var SEP = source_default.dim(" \u2502 ");
function usageDisplay(usage, stale) {
  const stalePrefix = stale ? source_default.dim("~") : "";
  if (!usage) {
    return `${stalePrefix}\u{1F550} ?${SEP}\u{1F4C5} ?`;
  }
  const h5 = usage.five_hour;
  const d7 = usage.seven_day;
  const h5v = h5?.utilization != null ? Math.floor(h5.utilization) : null;
  const d7v = d7?.utilization != null ? Math.floor(d7.utilization) : null;
  if (h5v === null && d7v === null) {
    return `${stalePrefix}\u{1F550} ?${SEP}\u{1F4C5} ?`;
  }
  const h5Exp = calcExpected(h5?.resets_at, WINDOW_5H);
  const d7Exp = calcExpected(d7?.resets_at, WINDOW_7D, true);
  const resetTime = resetTimeLocal(h5?.resets_at);
  const parts = [stalePrefix];
  if (h5v !== null) {
    const c = budgetColor(h5v, h5Exp);
    const expStr = h5Exp !== null ? String(Math.floor(h5Exp)) : "?";
    parts.push(`\u{1F550} ${bar(h5v, c, h5Exp)} ${source_default[c](String(h5v))} (${expStr})`);
  } else {
    parts.push("\u{1F550} ?");
  }
  if (resetTime) parts.push(` \u2192 ${resetTime}`);
  parts.push(SEP);
  if (d7v !== null) {
    const c = budgetColor(d7v, d7Exp);
    const expStr = d7Exp !== null ? String(Math.floor(d7Exp)) : "?";
    parts.push(`\u{1F4C5} ${bar(d7v, c, d7Exp)} ${source_default[c](String(d7v))} (${expStr})`);
  } else {
    parts.push("\u{1F4C5} ?");
  }
  return parts.join("");
}

// src/components/StatusLine.ts
var SEP2 = source_default.dim(" \u2502 ");
function formatStatusLine(model2, tokensUsed2, cache2) {
  const ctxPct2 = Math.min(Math.round(tokensUsed2 / COMPACT_AT * 100), 100);
  const git = getGitInfo();
  const riderUp = cache2?.rider_running ?? false;
  const serenaUp = cache2?.serena_running ?? false;
  const stale = isCacheVeryStale(cache2);
  const termWidth = process.stdout.columns ?? 80;
  const line1Parts = [source_default.cyan.bold(`\u26A1 ${model2}`)];
  if (git) line1Parts.push(source_default.cyan(` ${git}`));
  line1Parts.push(serviceBadge("Rider", riderUp));
  line1Parts.push(serviceBadge("Serena", serenaUp));
  const line1 = line1Parts.join(SEP2);
  const divider = source_default.dim("\u2500".repeat(termWidth));
  const ctxC = ctxColor(ctxPct2);
  const line2 = `Ctx ${bar(ctxPct2, ctxC)} ${formatTokens(tokensUsed2)}${SEP2}${usageDisplay(cache2?.usage, stale)}`;
  return `${line1}
${divider}
${line2}
${divider}`;
}

// src/command.ts
var __dirname = path3.dirname(fileURLToPath(import.meta.url));
var data = {};
try {
  const input = fs2.readFileSync(0, "utf-8");
  data = JSON.parse(input);
} catch {
}
var model = data.model?.display_name ?? data.model?.id ?? "?";
var ctxPct = Math.floor(Number(data.context_window?.used_percentage) || 0);
var ctxSize = Math.floor(Number(data.context_window?.context_window_size) || 2e5);
var tokensUsed = Math.floor(ctxSize * ctxPct / 100);
var cache = readCache();
if (isCacheStale(cache)) {
  try {
    const collector = path3.join(__dirname, "collector.mjs");
    const child = spawn(process.execPath, [collector], {
      detached: true,
      stdio: "ignore"
    });
    child.unref();
  } catch {
  }
}
try {
  const output = formatStatusLine(model, tokensUsed, cache);
  fs2.writeFileSync(1, output);
} catch {
  fs2.writeFileSync(1, `${model} | ?`);
}
process.exit(0);
