import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useInitials } from '@/hooks/use-initials';
import type { Team, User } from '@/types';

export function UserInfo({
    user,
    showEmail = false,
    team = null,
}: {
    user: User;
    showEmail?: boolean;
    team?: Team | null;
}) {
    const getInitials = useInitials();
    const showAvatar = Boolean(user.avatar && user.avatar !== '');

    return (
        <>
            <Avatar className="size-7 overflow-hidden rounded-md border border-border">
                {showAvatar ? (
                    <AvatarImage src={user.avatar} alt={user.name} />
                ) : null}
                <AvatarFallback className="rounded-md bg-muted text-[10px] font-semibold text-foreground">
                    {getInitials(user.name)}
                </AvatarFallback>
            </Avatar>
            <div className="ml-1 grid flex-1 text-left leading-tight">
                <span className="truncate text-[13px] font-medium text-foreground/90">
                    {user.name}
                </span>
                {team ? (
                    <span className="mt-0.5 truncate text-[11px] text-foreground/45">
                        {team.name}
                    </span>
                ) : null}
                {!team && showEmail ? (
                    <span className="truncate text-[11px] text-foreground/45">
                        {user.email}
                    </span>
                ) : null}
            </div>
        </>
    );
}
