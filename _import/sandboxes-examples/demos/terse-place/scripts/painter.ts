// The one command that each sandbox runs: a curl that calls `paint` on a Grid actor, so the sandbox needs no other
// package. The command reads the actor session from TERSE_SESSION in the sandbox's environment, so its text holds no
// token. curl tries again a few times when the actor does not answer.
export function painterCommand(actors: string, actor: string, pixel: number, color: number, requestId: string): string {
    const url = `${actors}/Grid/${encodeURIComponent(actor)}/invoke`
    if (/['\s]/.test(url + requestId)) throw new Error("the URL and the request id cannot hold quotes or spaces")
    const body = JSON.stringify({ requestId, method: "paint", args: [pixel, color] })
    return (
        "curl -fsS -m 10 --retry 4 --retry-all-errors --retry-delay 1 -o /dev/null" +
        ` -H "Authorization: Bearer $TERSE_SESSION" -H "Content-Type: application/json" -d '${body}' '${url}'`
    )
}
