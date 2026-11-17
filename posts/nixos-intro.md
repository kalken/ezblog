I have used NixOS for about two years, after 20+ years on Debian. It is the first time I have really seen a benefit in changing distribution. NixOS is different, but different in a good way.

NixOS is a Linux distribution where the whole system, from the bootloader to the services and installed programs, is described in configuration files. This is a short tour of what that means, what the files in `/etc/nixos` do, and the easiest way to live with it.

## Why NixOS

- **Declarative.** You write down what the system should look like, and NixOS builds it. The same files give you the same system on another machine.
- **Old configurations still boot.** Every successful build becomes a *generation* with its own entry in the boot menu. If an update breaks something, reboot into the previous one.
- **Upgrades are safe.** If a new configuration doesn't build, nothing changes: there is simply no new generation, and the running system is untouched.
- **A lot of software.** Nixpkgs has more packages than any other distribution.

The first point is the big one. On a normal system, the moment you edit a file in `/etc` by hand and don't write it down, the computer is in a state nobody knows, and it stays that way for the rest of its life. A year later you can't say why it behaves as it does, and you can't build the same system again. On NixOS the configuration *is* the system: if a change isn't in the files, it isn't on the machine, and if it is, you can read it.

The great thing about nixpkgs modules is that you only say what you want, and someone who knows much more than you has already written how to get it. `services.openssh.enable = true;` is a wish. The module behind it installs the package, writes the config file, creates the user, opens the right ports and starts the service, and you can set up a working service without knowing how any of that works. Because everything is options, the module can also be read and checked by people who do know the details, so the knowledge is shared instead of each person working it out alone.

NixOS and LLMs are a match made in heaven. Configuring a computer, or keeping it running, normally means knowing about every file in the system. On NixOS the problem shrinks to a few text files in the configuration folder. An LLM can read all of them at once, change them, and you can see exactly what it changed in the git diff before anything is built. If the result is wrong, the previous generation is still one reboot away.

## What is in nixpkgs

Nixpkgs is one big repository with two kinds of things in it.

**Packages** are the programs themselves: `firefox`, `git`, `vim` and tens of thousands more.

**Modules** are the options you set in your configuration. Two families matter most:

- `services.*` sets up a background service: `services.openssh.enable = true;` installs, configures and starts the SSH server.
- `programs.*` is a way to tune a package. `programs.git.enable = true;` installs git, and `programs.git.config` writes its system-wide settings, so the program and its configuration stay together.

To find out what exists, search at [search.nixos.org](https://search.nixos.org): it lists every package and every option, with its type, default and an example, and you paste what you find into `configuration.nix`.

You can also try a program without installing it:

```bash
nix run nixpkgs#cowsay -- hello
nix shell nixpkgs#htop nixpkgs#jq
```

`nix run` runs it once, and `nix shell` gives you a shell where the programs are available until you leave it. Nothing is added to the system.

## The files in /etc/nixos

A fresh install leaves a few files in `/etc/nixos`:

```
/etc/nixos/
  configuration.nix
  hardware-configuration.nix
  flake.nix        # if you use flakes
  flake.lock       # if you use flakes
```

**`hardware-configuration.nix`** describes this particular machine, and is made by `nixos-generate-config` during the install: which disks are mounted where, which kernel modules the boot needs, swap, and CPU microcode. You rarely edit it, and it is the file you don't copy to another computer.

**`configuration.nix`** is everything else you want: bootloader, host name, networking, users, installed packages, services. It is the file you will edit most.

```nix
{ pkgs, ... }: {
  networking.hostName = "mybox";
  users.users.alice = { isNormalUser = true; extraGroups = [ "wheel" ]; };
  environment.systemPackages = [ pkgs.vim pkgs.htop ];
  services.openssh.enable = true;
  system.stateVersion = "26.05";
}
```

`system.stateVersion` is the release you first installed. It is not the version you run, and you should leave it alone.

Some software has a license that is not open source (Steam, Nvidia's drivers, many fonts). Nixpkgs refuses to build it unless you allow it:

```nix
nixpkgs.config.allowUnfree = true;
```

## Labels instead of UUIDs

By default `nixos-generate-config` writes your disks into `hardware-configuration.nix`, each one by its UUID. A UUID is made when a partition is formatted, so after a reinstall or a new disk every one of them is wrong, and the file has to be regenerated or edited.

I prefer to give the partitions labels when I format them, and leave the disks out of the generated file. Label them while formatting:

```bash
mkfs.fat -F 32 -n bootfs /dev/nvme0n1p1
mkfs.ext4 -L rootfs /dev/nvme0n1p2
```

Generate the hardware file without any file systems:

```bash
nixos-generate-config --no-filesystems --root /mnt
```

Then describe the disks yourself, in `configuration.nix` or a file of their own, by label:

```nix
fileSystems."/" = {
  device = "/dev/disk/by-label/rootfs";
  fsType = "ext4";
};
fileSystems."/boot" = {
  device = "/dev/disk/by-label/bootfs";
  fsType = "vfat";
};
```

Now `hardware-configuration.nix` only says what the computer is (kernel modules, CPU microcode), and the disks say what you want. The same configuration works on a new disk, or on another machine, as long as the partitions have the same labels. An encrypted root works the same way: label the LUKS partition (`cryptsetup luksFormat ... --label rootfs_luks`) and point `boot.initrd.luks.devices` at `/dev/disk/by-label/rootfs_luks`.

## Installing packages

A package can be installed for the whole system or for chosen users. Take git as an example.

For everyone on the machine, add it to `environment.systemPackages`:

```nix
environment.systemPackages = [ pkgs.git ];
```

For one user only, add it to that user's `packages`. Other users won't have it:

```nix
users.users.alice.packages = [ pkgs.git ];
```

Git also has a module, so there is a third way, which installs it for the whole system and lets you configure it in the same place:

```nix
programs.git = {
  enable = true;
  config = {
    init.defaultBranch = "main";
    user.name = "Alice";
  };
};
```

The settings end up in `/etc/gitconfig`. Use `programs.NAME` when the program has a module (search.nixos.org tells you), and a plain package entry when it doesn't. In both cases the change only takes effect after a rebuild.

## What is a flake

A flake is a folder with a `flake.nix` that says where its inputs come from (usually nixpkgs, as a branch of a git repository) and what it produces (here, your system). Next to it, `flake.lock` records the exact commit of every input, so a build today and a build in a year use the same software.

A simple one, following the stable release, which comes out in May and November:

```nix
{
  description = "my computer";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-26.05";

  outputs = { nixpkgs, ... }: {
    nixosConfigurations.mybox = nixpkgs.lib.nixosSystem {
      modules = [
        ./hardware-configuration.nix
        ./configuration.nix
      ];
    };
  };
}
```

`nixos-26.05` is the branch of the stable release. To follow the rolling branch instead, with newer software and more breakage, use `nixos-unstable`. The name `mybox` is the one used when rebuilding: `--flake /etc/nixos#mybox`. The two files in `modules` are the ones described above.

Upgrading a flake means fetching the newest commit of each input and writing it into `flake.lock`:

```bash
nix flake update
```

Nothing is installed by that command. It only moves the pin; the next rebuild uses it.

`nix flake update` overwrites `flake.lock`, and the old pins are gone with it. If you want to be able to build an older version of your system again, save the old `flake.lock` first: keep the folder in git and commit before updating, or at least copy the file. A generation you have already built keeps booting without it, but rebuilding the same system later needs the lock file that went with it.

If the folder is a git repository, let Nix do the saving for you:

```bash
nix flake update --commit-lock-file
```

It commits the new `flake.lock` right after updating it, with a message listing what changed, so every update is one commit you can go back to.

## Keeping the configuration in git

The whole configuration is just text files, so it fits in a git repository, and then you get a history of every change you have made to the system. A flake in a git repository has one rule to know: **Nix only sees files that git knows about.** When you add a new file (a new `.nix` module, say), nothing complains, but the build acts as if the file isn't there until you add it:

```bash
git add newfile.nix
```

It does not have to be committed, `git add` is enough for the rebuild to pick it up. Changes to files that are already tracked are seen right away.

## Rebuilding

After editing, build and activate the new system:

```bash
sudo nixos-rebuild switch --flake /etc/nixos#mybox
```

What happens:

1. Nix evaluates the configuration and builds everything it needs into `/nix/store`. Each path there is named after a hash of its inputs, and nothing in it is ever overwritten.
2. The result is a new generation: a complete system, linked from `/nix/var/nix/profiles/system`, and a new entry in the boot menu.
3. It is *activated*: `/run/current-system` now points to it, changed config files are linked into place, and the services that changed are restarted.

`nixos-rebuild boot` does the first two steps and activates at the next boot, and `nixos-rebuild switch --rollback` goes back to the previous generation.

## Garbage collection

By default nothing is ever deleted. Every generation stays in the boot menu, and everything a generation uses stays in `/nix/store`, so the disk fills up slowly with old versions of everything you have ever run. Free it up by hand:

```bash
sudo nix-collect-garbage -d
```

This deletes all old generations and then every store path nothing uses any more. It also deletes your way back, so you can no longer roll back to what it removed. To keep a little history, only remove the old ones:

```bash
sudo nix-collect-garbage --delete-older-than 30d
```

`sudo` matters: without it only your own user's generations are cleaned, not the system's.

The boot menu still lists the deleted generations until it is rewritten, and picking one would not boot. So it is recommended to run both together:

```bash
sudo nix-collect-garbage -d && sudo /run/current-system/bin/switch-to-configuration boot
```

The second command rebuilds the boot menu from the generations that are left. Or let NixOS collect garbage on a schedule (the boot menu is then updated at the next rebuild):

```nix
nix.gc = {
  automatic = true;
  dates = "weekly";
  options = "--delete-older-than 30d";
};
```

## The easiest way to use it

Keep the **system** declarative and don't mix it with your personal settings. Put what the machine needs (services, drivers, system packages) in the NixOS configuration, and treat your home folder the way you would on any other system: dotfiles in git, or just a backup of the folder. That way a rebuild or a reinstall never has to know about your editor settings, and you don't have to learn everything about Nix before the machine is useful.
