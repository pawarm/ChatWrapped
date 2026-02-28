import { TopSender } from "@/types/conversation";
import { useEffect, useState } from "react"


export function StatsPage(){
    const [topSenders, setTopSenders] = useState<TopSender[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const data = await window.electronAPI.getTopSenders();
                if (mounted) setTopSenders(data);
            } finally {
                if (mounted) setLoading(false);
            }
        })();
        return () => {
            mounted = false;
        };
    }, []);
    return (
        <section>
            <h2>Top Senders</h2>
            {loading ? (
                <p>Loading...</p>
            ) : (
                <ul>
                    {topSenders.map((sender) => (
                        <li key={sender.sender}>
                            {sender.sender}: {sender.message_count} messages
                        </li>
                    ))}
                </ul>
            )}
        </section>
    )
}