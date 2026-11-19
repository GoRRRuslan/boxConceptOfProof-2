"""CPU per thread and buffer-queue statistics from a Perfetto trace of the app."""
import sys
from perfetto.trace_processor import TraceProcessor

trace_path, package_name = sys.argv[1], sys.argv[2]
processor = TraceProcessor(trace=trace_path)
query = lambda sql: list(processor.query(sql))

span_seconds = query("select (max(ts)-min(ts))/1e9 as s from sched")[0].s
print(f"trace span: {span_seconds:.2f} s")
print(f"\nCPU time per thread of {package_name}:")
total = 0
for row in query(f"""select thread.name tname, thread.tid tid, sum(sched.dur)/1e6 ms
    from sched join thread using(utid) join process using(upid)
    where process.name like '{package_name}%' group by thread.utid order by ms desc limit 10"""):
    print(f"  {row.ms:8.1f} ms  ({100 * row.ms / 1000 / span_seconds:5.1f}% of a core)  {row.tname} ({row.tid})")
    total += row.ms
print(f"  total top-10: {total:.0f} ms = {total / 1000 / span_seconds:.2f} cores on average")

print("\nBuffer queue (Filament -> TextureView) slices:")
for row in query("""select name, count(*) n, avg(dur)/1e6 avg_ms, max(dur)/1e6 max_ms from slice
    where name in ('queueBuffer','dequeueBuffer','updateTexImage') group by name order by n desc"""):
    print(f"  {row.n:5} x {row.name:15} avg {row.avg_ms:6.2f} ms  max {row.max_ms:7.2f} ms  ({row.n / span_seconds:.1f}/s)")
