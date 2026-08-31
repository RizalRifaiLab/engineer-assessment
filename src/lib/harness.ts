import type { CodeLanguage, TestCase } from "./types";

/**
 * Builds the source sent to the remote code runner (Judge0). JavaScript never
 * goes through here — it runs locally in a `node:vm` sandbox instead.
 *
 * Each harness embeds the candidate's code and runs the given test cases
 * against a function named `solve`. For every test it prints exactly one line:
 *   PASS
 *   FAIL <got>
 *   ERROR <message>
 * so the runner can map lines back to test cases. C++/Java/Python stringify
 * results in a JSON-like form (`[0, 1]`, `"olleh"`) so the UI can compare them
 * with the expected values.
 */

const cppHelpers = String.raw`
static string __esc(const string& v) {
  string r = "\"";
  for (char c : v) {
    switch (c) {
      case '"': r += "\\\""; break;
      case '\\': r += "\\\\"; break;
      case '\n': r += "\\n"; break;
      case '\t': r += "\\t"; break;
      case '\r': r += "\\r"; break;
      default: r += c;
    }
  }
  r += "\"";
  return r;
}
static string __to_s(int v) { return to_string(v); }
static string __to_s(long long v) { return to_string(v); }
static string __to_s(bool v) { return v ? "true" : "false"; }
static string __to_s(const string& v) { return __esc(v); }
template <typename T> static string __to_s(const vector<T>& v) {
  string r = "[";
  for (size_t i = 0; i < v.size(); i++) {
    if (i) r += ", ";
    r += __to_s(v[i]);
  }
  return r + "]";
}
`;

const javaHelpers = String.raw`
  static String __esc(String v) {
    StringBuilder b = new StringBuilder("\"");
    for (int i = 0; i < v.length(); i++) {
      char c = v.charAt(i);
      switch (c) {
        case '"': b.append("\\\""); break;
        case '\\': b.append("\\\\"); break;
        case '\n': b.append("\\n"); break;
        case '\t': b.append("\\t"); break;
        case '\r': b.append("\\r"); break;
        default: b.append(c);
      }
    }
    b.append("\"");
    return b.toString();
  }
  static String __toS(Object v) {
    if (v == null) return "null";
    if (v instanceof int[]) return Arrays.toString((int[]) v);
    if (v instanceof String[]) return Arrays.toString((String[]) v);
    if (v instanceof boolean[]) return Arrays.toString((boolean[]) v);
    if (v instanceof long[]) return Arrays.toString((long[]) v);
    if (v instanceof Integer) return Integer.toString((Integer) v);
    if (v instanceof Long) return Long.toString((Long) v);
    if (v instanceof Boolean) return Boolean.toString((Boolean) v);
    return __esc(String.valueOf(v));
  }
`;

/** A JSON-compatible escaped double-quoted string literal, valid in C++/Java too. */
function q(s: string): string {
  return JSON.stringify(s);
}

function cppLiteral(value: unknown): string {
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return `string(${q(value)})`;
  if (typeof value === "boolean") return value ? "true" : "false";
  if (Array.isArray(value)) {
    if (value.length === 0) return `vector<int>{}`;
    if (value.every((v) => typeof v === "number"))
      return `vector<int>{${value.map(String).join(",")}}`;
    if (value.every((v) => typeof v === "string"))
      return `vector<string>{${value.map((v) => q(v as string)).join(",")}}`;
  }
  throw new Error(`Unsupported C++ value: ${JSON.stringify(value)}`);
}

function javaLiteral(value: unknown): string {
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return q(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (Array.isArray(value)) {
    if (value.length === 0) return `new int[]{}`;
    if (value.every((v) => typeof v === "number"))
      return `new int[]{${value.map(String).join(",")}}`;
    if (value.every((v) => typeof v === "string"))
      return `new String[]{${value.map((v) => q(v as string)).join(",")}}`;
  }
  throw new Error(`Unsupported Java value: ${JSON.stringify(value)}`);
}

function base64(s: string): string {
  return Buffer.from(s, "utf-8").toString("base64");
}

/**
 * C++ args are bound to named variables first (via `auto&&`, which binds both
 * lvalues and rvalues) so the call works whether `solve` takes arguments by
 * value, by const reference, or by non-const reference.
 */
function cppNamedArgs(args: unknown[]): { decls: string; call: string } {
  const decls: string[] = [];
  const callArgs: string[] = [];
  args.forEach((a, i) => {
    decls.push(`    auto&& __a${i} = ${cppLiteral(a)};`);
    callArgs.push(`__a${i}`);
  });
  return { decls: decls.join("\n"), call: callArgs.join(", ") };
}

function cppTestBlock(test: TestCase): string {
  const named = cppNamedArgs(test.args);
  const expected = cppLiteral(test.expected);
  return `
  {
${named.decls}
    try {
      auto __r = solve(${named.call});
      if (__r == ${expected}) { cout << "PASS\\n"; }
      else { cout << "FAIL " << __to_s(__r) << "\\n"; }
    } catch (const exception& __e) {
      string __m = __e.what();
      for (auto& __c : __m) if (__c == '\\n' || __c == '\\r') __c = ' ';
      cout << "ERROR " << __m << "\\n";
    }
  }`;
}

function javaTestBlock(test: TestCase): string {
  const args = test.args.map(javaLiteral).join(", ");
  const expected = javaLiteral(test.expected);
  return `
    {
      try {
        Object __r = solve(${args});
        if (Objects.deepEquals(__r, ${expected})) System.out.println("PASS");
        else System.out.println("FAIL " + __toS(__r));
      } catch (Exception __e) {
        String __m = __e.getMessage();
        if (__m == null) __m = "exception";
        __m = __m.replace('\\n', ' ').replace('\\r', ' ');
        System.out.println("ERROR " + __m);
      }
    }`;
}

/** Full grading harness: runs every hidden test case and prints one line each. */
export function buildHarness(
  language: CodeLanguage,
  userCode: string,
  tests: TestCase[]
): string {
  switch (language) {
    case "python": {
      const payload = base64(JSON.stringify(tests.map((t) => [t.args, t.expected])));
      return [
        "import base64, json",
        "",
        userCode,
        "",
        "__payload = json.loads(base64.b64decode(\"" + payload + "\").decode(\"utf-8\"))",
        "def __fmt(x):",
        "    try:",
        "        return json.dumps(x)",
        "    except Exception:",
        "        return str(x)",
        "for __args, __exp in __payload:",
        "    try:",
        "        __r = solve(*__args)",
        "        if __r == __exp:",
        "            print(\"PASS\")",
        "        else:",
        "            print(\"FAIL \" + __fmt(__r))",
        "    except Exception as __e:",
        "        print(\"ERROR \" + str(__e).replace(\"\\n\", \" \").replace(\"\\r\", \" \"))",
      ].join("\n");
    }
    case "cpp": {
      return [
        "#include <bits/stdc++.h>",
        "using namespace std;",
        "",
        cppHelpers,
        userCode,
        "",
        "int main() {",
        tests.map(cppTestBlock).join("\n"),
        "  return 0;",
        "}",
      ].join("\n");
    }
    case "java": {
      return [
        "import java.util.*;",
        "",
        "public class Main {",
        javaHelpers,
        "",
        "  " + userCode.split("\n").join("\n  "),
        "",
        "  public static void main(String[] args) {",
        tests.map(javaTestBlock).join("\n"),
        "  }",
        "}",
      ].join("\n");
    }
    default:
      throw new Error(`No remote harness for language: ${language}`);
  }
}

/** Single-call harness for the "Run examples" preview (no comparison). */
export function buildRunHarness(
  language: CodeLanguage,
  userCode: string,
  args: unknown[]
): string {
  switch (language) {
    case "python": {
      const payload = base64(JSON.stringify(args));
      return [
        "import base64, json",
        "",
        userCode,
        "",
        "__args = json.loads(base64.b64decode(\"" + payload + "\").decode(\"utf-8\"))",
        "try:",
        "    __r = solve(*__args)",
        "    try:",
        "        print(json.dumps(__r))",
        "    except Exception:",
        "        print(str(__r))",
        "except Exception as __e:",
        "    print(\"ERROR \" + str(__e).replace(\"\\n\", \" \").replace(\"\\r\", \" \"))",
      ].join("\n");
    }
    case "cpp": {
      const named = cppNamedArgs(args);
      return [
        "#include <bits/stdc++.h>",
        "using namespace std;",
        "",
        cppHelpers,
        userCode,
        "",
        "int main() {",
        "  try {",
        named.decls,
        `    auto __r = solve(${named.call});`,
        '    cout << __to_s(__r) << "\\n";',
        "  } catch (const exception& __e) {",
        "    string __m = __e.what();",
        "    for (auto& __c : __m) if (__c == '\\n' || __c == '\\r') __c = ' ';",
        '    cout << "ERROR " << __m << "\\n";',
        "  }",
        "  return 0;",
        "}",
      ].join("\n");
    }
    case "java": {
      const literal = args.map(javaLiteral).join(", ");
      return [
        "import java.util.*;",
        "",
        "public class Main {",
        javaHelpers,
        "",
        "  " + userCode.split("\n").join("\n  "),
        "",
        "  public static void main(String[] args) {",
        "    try {",
        `      Object __r = solve(${literal});`,
        "      System.out.println(__toS(__r));",
        "    } catch (Exception __e) {",
        "      String __m = __e.getMessage();",
        "      if (__m == null) __m = \"exception\";",
        "      __m = __m.replace('\\n', ' ').replace('\\r', ' ');",
        "      System.out.println(\"ERROR \" + __m);",
        "    }",
        "  }",
        "}",
      ].join("\n");
    }
    default:
      throw new Error(`No remote harness for language: ${language}`);
  }
}
