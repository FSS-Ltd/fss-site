export function NetlifyFormRegistry() {
  return (
    <div className="sr-only" aria-hidden="true">
      <form name="fss-lead-capture" data-netlify="true" data-netlify-honeypot="bot-field">
        <input type="hidden" name="form-name" value="fss-lead-capture" />
        <input type="text" name="firstName" />
        <input type="text" name="lastName" />
        <input type="email" name="workEmail" />
        <input type="text" name="company" />
        <textarea name="challenge" />
        <input type="text" name="sourceContext" />
        <input type="text" name="sourcePath" />
        <input type="text" name="resourceSlug" />
        <input type="text" name="bot-field" />
      </form>
    </div>
  );
}
